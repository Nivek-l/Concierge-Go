-- ============================================================================
-- Concierge Go — 0003 Row Level Security, write guards and role-scoped RPCs
--
-- Principles
--   * Every table has RLS enabled. Nothing is readable by default.
--   * Customers see only their own rows. Agents see only tasks assigned to
--     them. Admins have full operational access.
--   * Column-level privacy that RLS cannot express (an agent must see the
--     customer's name and phone, but never their email) is handled by
--     SECURITY DEFINER RPCs that return a redacted payload.
--   * The task state machine is enforced by a database trigger, so an
--     unexpected transition is rejected even if application code is wrong.
-- ============================================================================

alter table public.roles                enable row level security;
alter table public.cities               enable row level security;
alter table public.profiles             enable row level security;
alter table public.addresses            enable row level security;
alter table public.task_categories      enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_attachments     enable row level security;
alter table public.task_quotes          enable row level security;
alter table public.payments             enable row level security;
alter table public.agents               enable row level security;
alter table public.agent_verifications  enable row level security;
alter table public.agent_service_areas  enable row level security;
alter table public.task_assignments     enable row level security;
alter table public.task_status_history  enable row level security;
alter table public.task_messages        enable row level security;
alter table public.task_proofs          enable row level security;
alter table public.notifications        enable row level security;
alter table public.disputes             enable row level security;
alter table public.reviews              enable row level security;

-- ---------------------------------------------------------------------------
-- Additional helpers
-- ---------------------------------------------------------------------------

create or replace function public.agent_ever_assigned(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.task_assignments ta
    where ta.task_id = p_task_id and ta.agent_id = public.current_agent_id()
  );
$$;

-- True for a trusted server context (service role key) where auth.uid() is absent.
create or replace function public.is_service_context()
returns boolean
language sql
stable
as $$
  select auth.uid() is null;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create policy "roles are readable" on public.roles
  for select using (true);

create policy "cities are readable" on public.cities
  for select using (true);

create policy "admins manage cities" on public.cities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "active categories are readable" on public.task_categories
  for select using (is_active or public.is_admin());

create policy "admins manage categories" on public.task_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles — own row, plus full access for operations. Cross-role visibility
-- is deliberately NOT granted here; use public.task_participants().
-- ---------------------------------------------------------------------------

create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "admins manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- A customer must never be able to promote themselves. Protected columns are
-- silently restored unless the actor is an admin or a trusted server context.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_context() or public.is_admin() then
    return new;
  end if;

  new.role := old.role;
  new.is_suspended := old.is_suspended;
  new.suspension_reason := old.suspension_reason;
  new.is_demo := old.is_demo;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------

create policy "manage own addresses" on public.addresses
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "admins read addresses" on public.addresses
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create policy "read permitted tasks" on public.tasks
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or public.agent_ever_assigned(id)
  );

create policy "customers create own tasks" on public.tasks
  for insert with check (
    customer_id = auth.uid()
    and status in ('draft', 'submitted')
  );

create policy "participants update tasks" on public.tasks
  for update using (
    customer_id = auth.uid()
    or public.is_admin()
    or public.is_assigned_agent(id)
  ) with check (
    customer_id = auth.uid()
    or public.is_admin()
    or public.is_assigned_agent(id)
  );

create policy "admins delete tasks" on public.tasks
  for delete using (public.is_admin());

-- --- Task state machine -----------------------------------------------------
--
-- Allowed transitions per actor. Anything not listed is rejected by the
-- database, whatever the application asks for.

create or replace function public.enforce_task_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor public.user_role;
  proof_count integer;
begin
  -- Ownership can only ever be changed by a trusted server context.
  if new.customer_id is distinct from old.customer_id and not public.is_service_context() then
    raise exception 'task ownership cannot be changed' using errcode = '42501';
  end if;

  -- References are immutable once issued.
  if new.reference is distinct from old.reference and not public.is_service_context() then
    raise exception 'task reference is immutable' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Proof gate: a task that requires proof cannot reach customer confirmation
  -- until at least one proof record exists.
  if new.status = 'awaiting_confirmation' and new.requires_proof then
    select count(*) into proof_count from public.task_proofs where task_id = new.id;
    if proof_count = 0 then
      raise exception 'proof of completion is required before requesting confirmation'
        using errcode = 'P0001';
    end if;
  end if;

  if public.is_service_context() or public.is_admin() then
    return new;
  end if;

  actor := public.auth_role();

  if actor = 'customer' then
    if not (
      (old.status = 'draft' and new.status = 'submitted')
      or (old.status = 'quoted' and new.status in ('awaiting_payment', 'under_review', 'cancelled'))
      or (old.status in ('submitted', 'under_review', 'awaiting_payment') and new.status = 'cancelled')
      or (old.status = 'awaiting_confirmation' and new.status in ('completed', 'disputed'))
    ) then
      raise exception 'transition % -> % is not allowed for a customer', old.status, new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  if actor = 'agent' then
    if not public.is_assigned_agent(new.id) then
      raise exception 'only the assigned agent can update this task' using errcode = '42501';
    end if;
    if not (
      (old.status = 'assigned' and new.status = 'en_route')
      or (old.status = 'en_route' and new.status = 'arrived')
      or (old.status = 'arrived' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'awaiting_confirmation')
    ) then
      raise exception 'transition % -> % is not allowed for an agent', old.status, new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not permitted to change task status' using errcode = '42501';
end;
$$;

create trigger tasks_enforce_transition
  before update on public.tasks
  for each row execute function public.enforce_task_transition();

-- ---------------------------------------------------------------------------
-- task_attachments
-- ---------------------------------------------------------------------------

create policy "read task attachments" on public.task_attachments
  for select using (public.can_access_task(task_id));

create policy "upload task attachments" on public.task_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_access_task(task_id)
  );

create policy "remove own attachments" on public.task_attachments
  for delete using (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- task_quotes — the customer and operations see the breakdown. Agents do not
-- see what the customer paid; they see their payout on the assignment.
-- ---------------------------------------------------------------------------

create policy "read own quotes" on public.task_quotes
  for select using (public.owns_task(task_id) or public.is_admin());

create policy "admins manage quotes" on public.task_quotes
  for all using (public.is_admin()) with check (public.is_admin());

-- Customers respond to quotes; only the response columns may move.
create policy "customers respond to quotes" on public.task_quotes
  for update using (public.owns_task(task_id) and status = 'sent')
  with check (public.owns_task(task_id) and status in ('accepted', 'declined'));

create or replace function public.guard_quote_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_context() or public.is_admin() then
    return new;
  end if;

  -- A customer may never touch the numbers.
  new.service_fee_kobo := old.service_fee_kobo;
  new.transport_fee_kobo := old.transport_fee_kobo;
  new.additional_fee_kobo := old.additional_fee_kobo;
  new.platform_fee_kobo := old.platform_fee_kobo;
  new.agent_payout_kobo := old.agent_payout_kobo;
  new.task_id := old.task_id;
  new.expires_at := old.expires_at;
  new.responded_at := now();
  return new;
end;
$$;

create trigger task_quotes_guard_update
  before update on public.task_quotes
  for each row execute function public.guard_quote_update();

-- ---------------------------------------------------------------------------
-- payments — readable by the payer and operations. Rows are only ever written
-- by the server (service role) after provider-side verification.
-- ---------------------------------------------------------------------------

create policy "read own payments" on public.payments
  for select using (customer_id = auth.uid() or public.is_admin());

create policy "admins read all payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------

create policy "agents read own record" on public.agents
  for select using (profile_id = auth.uid() or public.is_admin());

create policy "agents update own record" on public.agents
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "admins manage agents" on public.agents
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_agent_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_context() or public.is_admin() then
    return new;
  end if;

  -- Agents may edit their presentation and availability only.
  new.verification_status := old.verification_status;
  new.rating := old.rating;
  new.rating_count := old.rating_count;
  new.completed_tasks := old.completed_tasks;
  new.cancelled_tasks := old.cancelled_tasks;
  new.accepted_assignments := old.accepted_assignments;
  new.released_assignments := old.released_assignments;
  new.profile_id := old.profile_id;
  new.joined_at := old.joined_at;
  return new;
end;
$$;

create trigger agents_guard_update
  before update on public.agents
  for each row execute function public.guard_agent_update();

-- ---------------------------------------------------------------------------
-- agent_verifications
-- ---------------------------------------------------------------------------

create policy "agents read own verifications" on public.agent_verifications
  for select using (
    public.is_admin()
    or agent_id = public.current_agent_id()
  );

create policy "agents submit verifications" on public.agent_verifications
  for insert with check (
    agent_id = public.current_agent_id() and status = 'pending'
  );

create policy "admins review verifications" on public.agent_verifications
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- agent_service_areas
-- ---------------------------------------------------------------------------

create policy "agents manage own service areas" on public.agent_service_areas
  for all using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

create policy "admins manage service areas" on public.agent_service_areas
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- task_assignments
-- ---------------------------------------------------------------------------

create policy "read relevant assignments" on public.task_assignments
  for select using (
    public.is_admin()
    or agent_id = public.current_agent_id()
    or public.owns_task(task_id)
  );

create policy "admins manage assignments" on public.task_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- task_status_history — read-only trail; rows come from the trigger
-- ---------------------------------------------------------------------------

create policy "read task history" on public.task_status_history
  for select using (public.can_access_task(task_id));

-- ---------------------------------------------------------------------------
-- task_messages
-- ---------------------------------------------------------------------------

create policy "read task messages" on public.task_messages
  for select using (
    public.can_access_task(task_id) and (is_internal = false or public.is_admin())
  );

create policy "send task messages" on public.task_messages
  for insert with check (
    sender_id = auth.uid()
    and sender_role = public.auth_role()
    and public.can_access_task(task_id)
    and (is_internal = false or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- task_proofs
-- ---------------------------------------------------------------------------

create policy "read task proofs" on public.task_proofs
  for select using (public.can_access_task(task_id));

create policy "assigned agents submit proofs" on public.task_proofs
  for insert with check (
    public.is_admin() or public.is_assigned_agent(task_id)
  );

create policy "admins manage proofs" on public.task_proofs
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create policy "read own notifications" on public.notifications
  for select using (profile_id = auth.uid());

create policy "mark own notifications read" on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "admins read notifications" on public.notifications
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------

create policy "read task disputes" on public.disputes
  for select using (public.can_access_task(task_id));

create policy "customers raise disputes" on public.disputes
  for insert with check (
    raised_by = auth.uid() and public.owns_task(task_id) and status = 'open'
  );

create policy "admins resolve disputes" on public.disputes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create policy "read task reviews" on public.reviews
  for select using (public.can_access_task(task_id) or public.is_admin());

create policy "customers review completed tasks" on public.reviews
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.customer_id = auth.uid() and t.status = 'completed'
    )
  );

-- ============================================================================
-- Role-scoped RPCs
-- ============================================================================

-- Redacted participant details for a task. An agent sees the customer's name,
-- phone and area — never their email. A customer sees the agent's public
-- profile. Operations sees both.
create or replace function public.task_participants(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  viewer public.user_role;
  is_owner boolean;
  is_agent_on_task boolean;
  admin boolean := public.is_admin();
  result jsonb := '{}'::jsonb;
begin
  is_owner := public.owns_task(p_task_id);
  is_agent_on_task := public.is_assigned_agent(p_task_id);

  if not (admin or is_owner or is_agent_on_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  viewer := public.auth_role();

  if admin or is_agent_on_task then
    select jsonb_build_object(
      'customer', jsonb_build_object(
        'full_name', p.full_name,
        'phone', coalesce(t.contact_phone, p.phone),
        'area', coalesce(t.location_area, p.default_area),
        'email', case when admin then p.email else null end,
        'member_since', p.created_at
      )
    ) into result
    from public.tasks t
    join public.profiles p on p.id = t.customer_id
    where t.id = p_task_id;
  end if;

  select result || jsonb_build_object(
    'agent', case when a.id is null then null else jsonb_build_object(
      'id', a.id,
      'full_name', ap.full_name,
      'avatar_url', ap.avatar_url,
      'phone', case when admin or is_owner then ap.phone else null end,
      'headline', a.headline,
      'rating', a.rating,
      'rating_count', a.rating_count,
      'completed_tasks', a.completed_tasks,
      'verification_status', a.verification_status,
      'transport_mode', a.transport_mode
    ) end
  ) into result
  from public.tasks t
  left join public.task_assignments ta on ta.task_id = t.id and ta.status = 'active'
  left join public.agents a on a.id = ta.agent_id
  left join public.profiles ap on ap.id = a.profile_id
  where t.id = p_task_id;

  return coalesce(result, '{}'::jsonb);
end;
$$;

-- The agent job board. Deliberately redacted: an agent sees the area, not the
-- street address, until the task is actually theirs.
create or replace function public.available_tasks_for_agent()
returns table (
  id uuid,
  reference text,
  title text,
  summary text,
  category_name text,
  category_slug text,
  urgency public.task_urgency,
  city_name text,
  location_area text,
  destination_required boolean,
  preferred_date date,
  preferred_time_slot text,
  requires_proof boolean,
  agent_payout_kobo bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := public.current_agent_id();
  my_status public.verification_status;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select verification_status into my_status from public.agents where id = me;
  if my_status <> 'verified' then
    return;
  end if;

  return query
  select
    t.id,
    t.reference,
    t.title,
    left(t.description, 220) as summary,
    c.name as category_name,
    c.slug as category_slug,
    t.urgency,
    ci.name as city_name,
    t.location_area,
    t.destination_required,
    t.preferred_date,
    t.preferred_time_slot,
    t.requires_proof,
    coalesce(q.agent_payout_kobo, 0)::bigint as agent_payout_kobo,
    t.created_at
  from public.tasks t
  join public.task_categories c on c.id = t.category_id
  left join public.cities ci on ci.id = t.city_id
  left join public.task_quotes q on q.task_id = t.id and q.status = 'accepted'
  where t.status = 'paid'
    and not exists (
      select 1 from public.task_assignments ta
      where ta.task_id = t.id and ta.status = 'active'
    )
    and (
      t.city_id is null
      or exists (
        select 1 from public.agent_service_areas asa
        where asa.agent_id = me and asa.city_id = t.city_id
      )
    )
  order by
    case t.urgency when 'urgent' then 0 when 'priority' then 1 else 2 end,
    t.created_at asc;
end;
$$;

-- Atomic claim: the partial unique index on active assignments makes a double
-- claim impossible, and the workload cap is checked inside the same statement.
create or replace function public.agent_accept_task(p_task_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := public.current_agent_id();
  my_status public.verification_status;
  my_cap integer;
  active_count integer;
  task_row public.tasks;
  payout bigint;
  assignment_id uuid;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select verification_status, max_active_tasks into my_status, my_cap
  from public.agents where id = me;

  if my_status <> 'verified' then
    raise exception 'only verified agents can accept tasks' using errcode = 'P0001';
  end if;

  select count(*) into active_count
  from public.task_assignments ta
  join public.tasks t on t.id = ta.task_id
  where ta.agent_id = me and ta.status = 'active'
    and t.status not in ('completed', 'cancelled');

  if active_count >= my_cap then
    raise exception 'active task limit reached' using errcode = 'P0001';
  end if;

  select * into task_row from public.tasks where id = p_task_id for update;

  if task_row.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;

  if task_row.status <> 'paid' then
    raise exception 'this task is no longer available' using errcode = 'P0001';
  end if;

  if task_row.city_id is not null and not exists (
    select 1 from public.agent_service_areas asa
    where asa.agent_id = me and asa.city_id = task_row.city_id
  ) then
    raise exception 'task is outside your service area' using errcode = 'P0001';
  end if;

  select coalesce(agent_payout_kobo, 0) into payout
  from public.task_quotes where task_id = p_task_id and status = 'accepted'
  order by created_at desc limit 1;

  insert into public.task_assignments (task_id, agent_id, assigned_by, status, agent_payout_kobo, accepted_at)
  values (p_task_id, me, auth.uid(), 'active', coalesce(payout, 0), now())
  returning id into assignment_id;

  update public.tasks
  set status = 'assigned', assigned_at = now()
  where id = p_task_id;

  update public.agents
  set accepted_assignments = accepted_assignments + 1
  where id = me;

  return assignment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. RLS does the gating; these keep the surface explicit.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.roles, public.cities, public.task_categories to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.addresses, public.tasks, public.task_attachments,
  public.task_quotes, public.agents, public.agent_verifications,
  public.agent_service_areas, public.task_messages, public.task_proofs,
  public.notifications, public.disputes, public.reviews
to authenticated;

grant select on
  public.payments, public.task_assignments, public.task_status_history
to authenticated;

revoke execute on function public.admin_dashboard_stats() from public;
revoke execute on function public.agent_dashboard_stats() from public;
revoke execute on function public.available_tasks_for_agent() from public;
revoke execute on function public.agent_accept_task(uuid) from public;
revoke execute on function public.task_participants(uuid) from public;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.agent_dashboard_stats() to authenticated;
grant execute on function public.available_tasks_for_agent() to authenticated;
grant execute on function public.agent_accept_task(uuid) to authenticated;
grant execute on function public.task_participants(uuid) to authenticated;
