-- ============================================================================
-- Concierge Go — realtime task updates, live task location and PWA push
-- ============================================================================

-- Optional pins captured from the customer's device. Text addresses remain the
-- source shown to operations; coordinates make the live map precise.
alter table public.tasks
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists destination_latitude double precision,
  add column if not exists destination_longitude double precision;

alter table public.tasks
  add constraint tasks_location_coordinates_valid check (
    num_nonnulls(location_latitude, location_longitude) = 0
    or (
      num_nonnulls(location_latitude, location_longitude) = 2
      and
      location_latitude between -90 and 90
      and location_longitude between -180 and 180
    )
  ),
  add constraint tasks_destination_coordinates_valid check (
    num_nonnulls(destination_latitude, destination_longitude) = 0
    or (
      num_nonnulls(destination_latitude, destination_longitude) = 2
      and
      destination_latitude between -90 and 90
      and destination_longitude between -180 and 180
    )
  );

create table public.task_live_locations (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_metres double precision check (accuracy_metres is null or accuracy_metres >= 0),
  heading_degrees double precision check (
    heading_degrees is null or heading_degrees between 0 and 360
  ),
  speed_metres_per_second double precision check (
    speed_metres_per_second is null or speed_metres_per_second >= 0
  ),
  is_tracking boolean not null default true,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_live_locations_agent_idx
  on public.task_live_locations (agent_id, is_tracking, recorded_at desc);

create trigger set_updated_at
  before update on public.task_live_locations
  for each row execute function public.set_updated_at();

alter table public.task_live_locations enable row level security;

create policy "task participants read live location" on public.task_live_locations
  for select using (public.can_access_task(task_id));

create policy "assigned agents start live location" on public.task_live_locations
  for insert with check (
    agent_id = public.current_agent_id()
    and public.is_assigned_agent(task_id)
    and exists (
      select 1 from public.task_assignments ta
      where ta.id = assignment_id
        and ta.task_id = task_live_locations.task_id
        and ta.agent_id = task_live_locations.agent_id
        and ta.status = 'active'
    )
  );

create policy "assigned agents update live location" on public.task_live_locations
  for update using (
    agent_id = public.current_agent_id()
    and public.is_assigned_agent(task_id)
  ) with check (
    agent_id = public.current_agent_id()
    and public.is_assigned_agent(task_id)
    and exists (
      select 1 from public.task_assignments ta
      where ta.id = assignment_id
        and ta.task_id = task_live_locations.task_id
        and ta.agent_id = task_live_locations.agent_id
        and ta.status = 'active'
    )
  );

grant select, insert, update on public.task_live_locations to authenticated;

-- Closing the working phase also closes location sharing. The most recent pin
-- remains available to authorised task participants as an operational record.
create or replace function public.stop_task_live_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('awaiting_confirmation', 'completed', 'cancelled', 'disputed')
     and new.status is distinct from old.status then
    update public.task_live_locations
    set is_tracking = false,
        recorded_at = now()
    where task_id = new.id and is_tracking;
  end if;
  return null;
end;
$$;

create trigger tasks_stop_live_location
  after update of status on public.tasks
  for each row execute function public.stop_task_live_location();

-- Browser push subscriptions are private to each signed-in profile. Sending is
-- performed by the server with the VAPID private key.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

create trigger set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "profiles manage own push subscriptions" on public.push_subscriptions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Quotes created after this migration use 60/40 in application code. Bring
-- unassigned existing quotes into line without reducing an agent's already
-- accepted active or completed assignment.
update public.task_quotes q
set agent_payout_kobo = round(q.platform_fee_kobo * 0.60)
where not exists (
  select 1 from public.task_assignments ta where ta.task_id = q.task_id
);

-- Enable authenticated Postgres Changes subscriptions. The existence check
-- keeps this migration safe on projects where a table is already published.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'tasks',
      'task_quotes',
      'payments',
      'task_assignments',
      'task_proofs',
      'task_messages',
      'notifications',
      'disputes',
      'agent_payouts',
      'task_live_locations'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
