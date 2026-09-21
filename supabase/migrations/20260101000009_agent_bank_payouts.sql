-- ============================================================================
-- Concierge Go — agent bank accounts and Paystack transfer tracking
-- ============================================================================

create table public.agent_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references public.agents (id) on delete cascade,
  account_name text not null check (btrim(account_name) <> ''),
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  bank_code text not null check (btrim(bank_code) <> ''),
  bank_name text not null check (btrim(bank_name) <> ''),
  recipient_code text,
  recipient_active boolean not null default false,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_bank_accounts is
  'Verified Nigerian payout accounts. Never stores a card number, PIN, OTP or BVN.';

create trigger set_updated_at
  before update on public.agent_bank_accounts
  for each row execute function public.set_updated_at();

alter table public.agent_bank_accounts enable row level security;

create policy "agents read own bank account" on public.agent_bank_accounts
  for select using (agent_id = public.current_agent_id());

create policy "agents create own bank account" on public.agent_bank_accounts
  for insert with check (agent_id = public.current_agent_id());

create policy "agents update own bank account" on public.agent_bank_accounts
  for update using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

create policy "admins read agent bank accounts" on public.agent_bank_accounts
  for select using (public.is_admin());

grant select, insert, update on public.agent_bank_accounts to authenticated;

alter table public.agent_payouts
  add column payout_method text not null default 'manual'
    check (payout_method in ('manual', 'paystack')),
  add column provider_transfer_code text,
  add column provider_status text,
  add column transfer_initiated_at timestamptz,
  add column failure_reason text;

create unique index agent_payouts_payment_reference_unique
  on public.agent_payouts (payment_reference)
  where payment_reference is not null and payout_method = 'paystack';

create index agent_payouts_provider_transfer_idx
  on public.agent_payouts (provider_transfer_code)
  where provider_transfer_code is not null;

-- The earning itself is immutable. Provider tracking fields may change while
-- Paystack processes, fails or reverses a transfer.
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

-- Realtime refreshes the admin and agent ledgers when a transfer webhook
-- records its final state.
do $$
begin
  alter publication supabase_realtime add table public.agent_bank_accounts;
exception
  when duplicate_object then null;
end $$;
