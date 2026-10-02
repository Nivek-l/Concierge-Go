-- ============================================================================
-- Concierge Go -- automatic service-charge allocation
--
-- Operations enters one combined service charge. The quote stores a transparent
-- customer-facing allocation of 20% transportation and 80% task execution.
-- The agent earns 60% of the complete service charge, including transportation;
-- Concierge Go retains 40%.
-- ============================================================================

create or replace function public.normalize_quote_service_charge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  service_charge bigint;
begin
  service_charge := coalesce(new.transport_fee_kobo, 0) + coalesce(new.platform_fee_kobo, 0);

  new.transport_fee_kobo := round(service_charge * 0.20)::bigint;
  new.platform_fee_kobo := service_charge - new.transport_fee_kobo;
  new.agent_payout_kobo := round(service_charge * 0.60)::bigint;

  return new;
end;
$$;

drop trigger if exists task_quotes_normalize_service_charge on public.task_quotes;
create trigger task_quotes_normalize_service_charge
  before insert or update of transport_fee_kobo, platform_fee_kobo, agent_payout_kobo
  on public.task_quotes
  for each row execute function public.normalize_quote_service_charge();

-- Pending quotes have not yet been accepted, so align them with the new model
-- without changing the total the customer was originally shown.
update public.task_quotes
set
  transport_fee_kobo = round((transport_fee_kobo + platform_fee_kobo) * 0.20)::bigint,
  platform_fee_kobo = (transport_fee_kobo + platform_fee_kobo)
    - round((transport_fee_kobo + platform_fee_kobo) * 0.20)::bigint,
  agent_payout_kobo = round((transport_fee_kobo + platform_fee_kobo) * 0.60)::bigint
where status = 'sent';
