-- ============================================================================
-- Concierge Go — performance indexes, agent payout ledger and availability
-- ============================================================================

create type public.payout_status as enum (
  'pending',
  'approved',
  'paid',
  'held',
  'cancelled'
);

create table public.agent_payouts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.task_assignments (id) on delete restrict,
  task_id uuid not null references public.tasks (id) on delete restrict,
  agent_id uuid not null references public.agents (id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  status public.payout_status not null default 'pending',
  available_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  payment_reference text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_payouts_paid_details check (
    status <> 'paid' or (paid_at is not null and btrim(coalesce(payment_reference, '')) <> '')
  )
);

create trigger set_updated_at
  before update on public.agent_payouts
  for each row execute function public.set_updated_at();

create index agent_payouts_agent_status_idx
  on public.agent_payouts (agent_id, status, created_at desc);
create index agent_payouts_status_available_idx
  on public.agent_payouts (status, available_at, created_at);
create index agent_payouts_task_idx on public.agent_payouts (task_id);

-- Common dashboard and workflow query paths.
create index if not exists tasks_status_created_idx
  on public.tasks (status, created_at desc);
create index if not exists tasks_customer_status_created_idx
  on public.tasks (customer_id, status, created_at desc);
create index if not exists task_assignments_agent_status_assigned_idx
  on public.task_assignments (agent_id, status, assigned_at desc);
create index if not exists task_quotes_task_status_created_idx
  on public.task_quotes (task_id, status, created_at desc);
create index if not exists payments_task_status_created_idx
  on public.payments (task_id, status, created_at desc);
create index if not exists disputes_status_created_idx
  on public.disputes (status, created_at desc);

alter table public.agent_payouts enable row level security;

create policy "agents read own payout ledger" on public.agent_payouts
  for select using (agent_id = public.current_agent_id());

create policy "admins manage payout ledger" on public.agent_payouts
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.agent_payouts to authenticated;
grant update on public.agent_payouts to authenticated;

-- Totals stay accurate even when the paginated ledger grows beyond the first
-- page. RLS is intentionally preserved by using the caller's privileges.
create or replace function public.payout_ledger_summary(p_agent_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'pending_kobo', coalesce(sum(amount_kobo) filter (where status = 'pending'), 0),
    'approved_kobo', coalesce(sum(amount_kobo) filter (where status = 'approved'), 0),
    'paid_kobo', coalesce(sum(amount_kobo) filter (where status = 'paid'), 0),
    'held_kobo', coalesce(sum(amount_kobo) filter (where status = 'held'), 0)
  )
  from public.agent_payouts
  where p_agent_id is null or agent_id = p_agent_id;
$$;

grant execute on function public.payout_ledger_summary(uuid) to authenticated;

create or replace function public.enforce_agent_payout_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.assignment_id <> old.assignment_id
     or new.task_id <> old.task_id
     or new.agent_id <> old.agent_id
     or new.amount_kobo <> old.amount_kobo then
    raise exception 'payout earning fields are immutable' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('approved', 'held', 'cancelled'))
    or (old.status = 'approved' and new.status in ('paid', 'held', 'cancelled'))
    or (old.status = 'held' and new.status in ('pending', 'approved', 'cancelled'))
  ) then
    raise exception 'invalid payout status transition' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_agent_payout_update
  before update on public.agent_payouts
  for each row execute function public.enforce_agent_payout_update();

-- A completed assignment creates exactly one immutable earning record. The
-- unique assignment_id makes callback/admin/customer completion races safe.
create or replace function public.create_agent_payout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed'
     and new.agent_payout_kobo > 0
     and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from 'completed')) then
    insert into public.agent_payouts (
      assignment_id,
      task_id,
      agent_id,
      amount_kobo,
      status,
      available_at
    ) values (
      new.id,
      new.task_id,
      new.agent_id,
      new.agent_payout_kobo,
      'pending',
      coalesce(new.completed_at, now())
    )
    on conflict (assignment_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger task_assignments_create_payout
  after insert or update of status on public.task_assignments
  for each row execute function public.create_agent_payout();

-- Completion releases the agent from active work in the same transaction as
-- the task status change. The assignment remains as `completed` history so it
-- can still support payouts, ratings and performance reporting.
--
-- This trigger name intentionally sorts before tasks_refresh_agent_counts,
-- ensuring the completed assignment is visible when agent totals are rebuilt.
create or replace function public.complete_active_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.task_assignments
    set status = 'completed',
        completed_at = coalesce(new.completed_at, now())
    where task_id = new.id
      and status = 'active';
  end if;

  return null;
end;
$$;

create trigger tasks_complete_active_assignment
  after update of status on public.tasks
  for each row execute function public.complete_active_task_assignment();

-- Preserve earnings from assignments completed before this migration.
insert into public.agent_payouts (
  assignment_id,
  task_id,
  agent_id,
  amount_kobo,
  status,
  available_at
)
select
  ta.id,
  ta.task_id,
  ta.agent_id,
  ta.agent_payout_kobo,
  'pending',
  coalesce(ta.completed_at, ta.updated_at)
from public.task_assignments ta
where ta.status = 'completed'
  and ta.agent_payout_kobo > 0
on conflict (assignment_id) do nothing;

-- Keep unavailable agents out of the job board as well as the acceptance RPC.
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
  my_available boolean;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select verification_status, is_available
    into my_status, my_available
  from public.agents
  where id = me;

  if my_status <> 'verified' or not coalesce(my_available, false) then
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

-- Unavailable agents must not see or self-accept new jobs. Locking the agent row
-- also makes the workload-cap check reliable during concurrent accepts.
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
  my_available boolean;
  my_cap integer;
  active_count integer;
  task_row public.tasks;
  payout bigint;
  assignment_id uuid;
begin
  if me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select verification_status, is_available, max_active_tasks
    into my_status, my_available, my_cap
  from public.agents
  where id = me
  for update;

  if my_status <> 'verified' then
    raise exception 'only verified agents can accept tasks' using errcode = 'P0001';
  end if;
  if not my_available then
    raise exception 'turn on availability before accepting a task' using errcode = 'P0001';
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

  insert into public.task_assignments (
    task_id, agent_id, assigned_by, status, agent_payout_kobo, accepted_at
  ) values (
    p_task_id, me, auth.uid(), 'active', coalesce(payout, 0), now()
  ) returning id into assignment_id;

  update public.tasks set status = 'assigned', assigned_at = now()
  where id = p_task_id;

  update public.agents
  set accepted_assignments = accepted_assignments + 1
  where id = me;

  return assignment_id;
end;
$$;

grant execute on function public.agent_accept_task(uuid) to authenticated;
