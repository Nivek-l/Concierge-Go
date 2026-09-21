-- ============================================================================
-- Concierge Go — repair assignment release and agent rating aggregates
-- ============================================================================
-- This migration is intentionally corrective: it recreates the two triggers
-- and repairs rows that became stale before the triggers were available.

-- A completed task must never keep consuming an agent's active-task capacity.
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

drop trigger if exists tasks_complete_active_assignment on public.tasks;
create trigger tasks_complete_active_assignment
  after update of status on public.tasks
  for each row execute function public.complete_active_task_assignment();

-- Repair assignments that were left active by earlier deployments.
update public.task_assignments ta
set status = 'completed',
    completed_at = coalesce(ta.completed_at, t.completed_at, now())
from public.tasks t
where t.id = ta.task_id
  and t.status = 'completed'
  and ta.status = 'active';

-- A completed assignment earns the agent's agreed share exactly once. Rebuild
-- the trigger and backfill any completed assignments missing from the ledger.
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

drop trigger if exists task_assignments_create_payout on public.task_assignments;
create trigger task_assignments_create_payout
  after insert or update of status on public.task_assignments
  for each row execute function public.create_agent_payout();

insert into public.agent_payouts (
  assignment_id,
  task_id,
  agent_id,
  amount_kobo,
  status,
  available_at
)
select
  assignment.id,
  assignment.task_id,
  assignment.agent_id,
  assignment.agent_payout_kobo,
  'pending',
  coalesce(assignment.completed_at, assignment.updated_at, now())
from public.task_assignments assignment
join public.tasks task on task.id = assignment.task_id
where assignment.status = 'completed'
  and task.status = 'completed'
  and assignment.agent_payout_kobo > 0
on conflict (assignment_id) do nothing;

-- Rebuild an agent's average whenever a review is inserted, changed or
-- deleted. Updating a review's agent_id recalculates both affected agents.
create or replace function public.refresh_agent_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_agent_id uuid;
begin
  for target_agent_id in
    select distinct agent_id
    from (
      select case when tg_op <> 'DELETE' then new.agent_id end as agent_id
      union all
      select case when tg_op <> 'INSERT' then old.agent_id end as agent_id
    ) affected
    where agent_id is not null
  loop
    update public.agents a
    set rating = coalesce((
          select round(avg(r.rating)::numeric, 2)
          from public.reviews r
          where r.agent_id = target_agent_id
        ), 0),
        rating_count = (
          select count(*)::integer
          from public.reviews r
          where r.agent_id = target_agent_id
        )
    where a.id = target_agent_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists reviews_refresh_agent_rating on public.reviews;
create trigger reviews_refresh_agent_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_agent_rating();

-- Repair all current aggregates from the reviews table.
update public.agents a
set rating = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.agent_id = a.id
    ), 0),
    rating_count = (
      select count(*)::integer
      from public.reviews r
      where r.agent_id = a.id
    ),
    completed_tasks = (
      select count(*)::integer
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id
      where ta.agent_id = a.id
        and ta.status = 'completed'
        and t.status = 'completed'
    );

-- Completed tasks must not continue broadcasting an agent's position.
update public.task_live_locations location
set is_tracking = false,
    recorded_at = now()
from public.tasks task
where task.id = location.task_id
  and task.status in ('awaiting_confirmation', 'completed', 'cancelled', 'disputed')
  and location.is_tracking;
