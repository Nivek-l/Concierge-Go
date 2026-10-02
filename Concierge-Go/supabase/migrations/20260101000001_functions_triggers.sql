-- ============================================================================
-- Concierge Go — 0002 functions, triggers and authorization helpers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'addresses', 'tasks', 'task_quotes', 'payments', 'agents',
    'agent_verifications', 'task_assignments', 'disputes'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Human-friendly task references, e.g. CG-2609-4KD2P
-- ---------------------------------------------------------------------------

create or replace function public.generate_task_reference()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    candidate := 'CG-'
      || to_char(now(), 'YYMM')
      || '-'
      || upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=OI01lL', 'ABCDEFGHJ'), 1, 5));
    exit when not exists (select 1 from public.tasks where reference = candidate);
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := 'CG-' || to_char(now(), 'YYMMDDHH24MISS');
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

alter table public.tasks
  alter column reference set default public.generate_task_reference();

-- ---------------------------------------------------------------------------
-- Signup: create the profile (and the agent record for agent signups).
--
-- The role is read from user metadata but clamped to customer/agent — an admin
-- can never be created through public signup.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  resolved_role public.user_role;
  city uuid;
  new_agent_id uuid;
begin
  resolved_role := case when requested_role = 'agent' then 'agent'::public.user_role
                        else 'customer'::public.user_role end;

  select id into city
  from public.cities
  where slug = coalesce(new.raw_user_meta_data ->> 'city_slug', 'calabar')
  limit 1;

  insert into public.profiles (id, role, full_name, email, phone, default_city_id, default_area)
  values (
    new.id,
    resolved_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    city,
    nullif(btrim(new.raw_user_meta_data ->> 'default_area'), '')
  )
  on conflict (id) do nothing;

  if resolved_role = 'agent' then
    insert into public.agents (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing
    returning id into new_agent_id;

    if new_agent_id is not null and city is not null then
      insert into public.agent_service_areas (agent_id, city_id, area_name)
      values (new_agent_id, city, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'default_area'), ''), 'Calabar Municipality'))
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step with a confirmed email change.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Authorization helpers.
--
-- These are SECURITY DEFINER so that RLS policies on public.profiles can call
-- them without recursing into the very policy being evaluated.
-- ---------------------------------------------------------------------------

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_suspended = false
  );
$$;

create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agent' and is_suspended = false
  );
$$;

create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id
  from public.agents a
  join public.profiles p on p.id = a.profile_id
  where a.profile_id = auth.uid() and p.is_suspended = false;
$$;

-- Is the caller the agent currently holding this task?
create or replace function public.is_assigned_agent(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.task_assignments ta
    where ta.task_id = p_task_id
      and ta.status = 'active'
      and ta.agent_id = public.current_agent_id()
  );
$$;

create or replace function public.owns_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.customer_id = auth.uid()
  );
$$;

-- Single predicate used by every task-scoped policy.
create or replace function public.can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or public.owns_task(p_task_id)
      or public.is_assigned_agent(p_task_id);
$$;

-- ---------------------------------------------------------------------------
-- Status history is written by the database, so the timeline can never be
-- forged or forgotten by application code.
-- ---------------------------------------------------------------------------

create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by, actor_role)
    values (new.id, null, new.status, auth.uid(), public.auth_role());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by, actor_role)
    values (new.id, old.status, new.status, auth.uid(), public.auth_role());
  end if;

  return new;
end;
$$;

create trigger tasks_log_status_insert
  after insert on public.tasks
  for each row execute function public.log_task_status_change();

create trigger tasks_log_status_update
  after update of status on public.tasks
  for each row execute function public.log_task_status_change();

-- ---------------------------------------------------------------------------
-- Agent aggregates derived from source-of-truth rows.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_agent_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.agent_id, old.agent_id);
begin
  update public.agents a
  set rating = coalesce(agg.avg_rating, 0),
      rating_count = coalesce(agg.total, 0)
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as total
    from public.reviews
    where agent_id = target
  ) agg
  where a.id = target;

  return null;
end;
$$;

create trigger reviews_refresh_agent_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_agent_rating();

create or replace function public.refresh_agent_task_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.agents a
    set completed_tasks = (
      select count(*)
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id
      where ta.agent_id = a.id and ta.status = 'completed' and t.status = 'completed'
    )
    where a.id in (
      select agent_id from public.task_assignments
      where task_id = new.id and status in ('active', 'completed')
    );
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.agents a
    set cancelled_tasks = a.cancelled_tasks + 1
    where a.id in (
      select agent_id from public.task_assignments
      where task_id = new.id and status = 'active'
    );
  end if;

  return null;
end;
$$;

create trigger tasks_refresh_agent_counts
  after update of status on public.tasks
  for each row execute function public.refresh_agent_task_counts();

-- ---------------------------------------------------------------------------
-- Dashboard aggregates. SECURITY DEFINER with an explicit role guard so a
-- single round trip can replace a dozen count queries.
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_customers', (select count(*) from public.profiles where role = 'customer'),
    'total_agents', (select count(*) from public.agents),
    'active_agents', (
      select count(*) from public.agents
      where verification_status = 'verified' and is_available
    ),
    'pending_verifications', (
      select count(*) from public.agents where verification_status = 'pending'
    ),
    'tasks_total', (select count(*) from public.tasks where status <> 'draft'),
    'tasks_awaiting_review', (
      select count(*) from public.tasks where status in ('submitted', 'under_review')
    ),
    'quotes_awaiting_response', (
      select count(*) from public.task_quotes where status = 'sent'
    ),
    'tasks_awaiting_payment', (
      select count(*) from public.tasks where status = 'awaiting_payment'
    ),
    'tasks_awaiting_assignment', (select count(*) from public.tasks where status = 'paid'),
    'tasks_active', (
      select count(*) from public.tasks
      where status in ('assigned', 'en_route', 'arrived', 'in_progress', 'awaiting_confirmation')
    ),
    'tasks_completed', (select count(*) from public.tasks where status = 'completed'),
    'open_disputes', (
      select count(*) from public.disputes where status in ('open', 'under_review')
    ),
    'gross_revenue_kobo', (
      select coalesce(sum(amount_kobo), 0) from public.payments where status = 'succeeded'
    ),
    'platform_fees_kobo', (
      select coalesce(sum(q.platform_fee_kobo), 0)
      from public.task_quotes q
      join public.payments p on p.quote_id = q.id and p.status = 'succeeded'
    ),
    'agent_payouts_kobo', (
      select coalesce(sum(ta.agent_payout_kobo), 0)
      from public.task_assignments ta
      where ta.status = 'completed'
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.agent_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := public.current_agent_id();
  result jsonb;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'active_tasks', (
      select count(*)
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id
      where ta.agent_id = me and ta.status = 'active'
        and t.status in ('assigned', 'en_route', 'arrived', 'in_progress', 'awaiting_confirmation')
    ),
    'completed_tasks', (
      select count(*)
      from public.task_assignments ta
      where ta.agent_id = me and ta.status = 'completed'
    ),
    'earnings_kobo', (
      select coalesce(sum(ta.agent_payout_kobo), 0)
      from public.task_assignments ta
      where ta.agent_id = me and ta.status = 'completed'
    ),
    'pending_earnings_kobo', (
      select coalesce(sum(ta.agent_payout_kobo), 0)
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id
      where ta.agent_id = me and ta.status = 'active' and t.status <> 'cancelled'
    ),
    'rating', (select rating from public.agents where id = me),
    'rating_count', (select rating_count from public.agents where id = me),
    'verification_status', (select verification_status from public.agents where id = me),
    'available_tasks', (
      select count(*)
      from public.tasks t
      where t.status = 'paid'
        and not exists (
          select 1 from public.task_assignments ta
          where ta.task_id = t.id and ta.status = 'active'
        )
        and (
          t.city_id is null or exists (
            select 1 from public.agent_service_areas asa
            where asa.agent_id = me and asa.city_id = t.city_id
          )
        )
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage path helper — buckets are laid out as <task_id>/<file>, so a storage
-- policy can resolve the owning task from the object name.
-- ---------------------------------------------------------------------------

create or replace function public.storage_task_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  return first_segment::uuid;
exception
  when others then return null;
end;
$$;
