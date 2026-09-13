-- ============================================================================
-- Concierge Go — 0001 initial schema
-- Nigerian on-demand task execution platform (launch city: Calabar, CRS)
--
-- Conventions
--   * UUID primary keys everywhere (gen_random_uuid from pgcrypto).
--   * All money is stored as integer KOBO (1 NGN = 100 kobo) to avoid float
--     rounding, and because Paystack transacts in kobo.
--   * created_at / updated_at on every mutable table (updated_at via trigger
--     installed in 0002).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'agent', 'admin');

create type public.task_status as enum (
  'draft',
  'submitted',
  'under_review',
  'quoted',
  'awaiting_payment',
  'paid',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'awaiting_confirmation',
  'completed',
  'cancelled',
  'disputed'
);

create type public.task_urgency as enum ('standard', 'priority', 'urgent');

create type public.quote_status as enum ('sent', 'accepted', 'declined', 'expired', 'superseded');

create type public.payment_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'abandoned',
  'refunded'
);

create type public.payment_provider as enum ('mock', 'paystack');

create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');

create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');

create type public.dispute_reason as enum (
  'not_completed',
  'incorrect_item',
  'missing_proof',
  'agent_issue',
  'other'
);

create type public.proof_type as enum ('photo', 'video', 'receipt', 'document', 'text');

create type public.attachment_kind as enum ('request', 'dispute');

create type public.assignment_status as enum ('active', 'released', 'reassigned', 'completed');

create type public.notification_type as enum (
  'task_submitted',
  'task_reviewed',
  'quote_received',
  'quote_accepted',
  'quote_declined',
  'payment_received',
  'agent_assigned',
  'task_started',
  'proof_uploaded',
  'task_completed',
  'task_cancelled',
  'dispute_created',
  'dispute_resolved',
  'message_received',
  'agent_verification_updated',
  'task_available'
);

-- ---------------------------------------------------------------------------
-- roles — lookup table describing what each role may do. profiles.role is a
-- FK onto this table so the set of roles is data, not scattered constants.
-- ---------------------------------------------------------------------------

create table public.roles (
  key public.user_role primary key,
  label text not null,
  description text not null,
  can_access_admin boolean not null default false,
  can_execute_tasks boolean not null default false
);

insert into public.roles (key, label, description, can_access_admin, can_execute_tasks) values
  ('customer', 'Customer', 'Requests tasks and pays for them.', false, false),
  ('agent', 'Go Agent', 'Verified local agent who executes tasks on behalf of customers.', false, true),
  ('admin', 'Operations', 'Concierge Go operations team. Reviews, quotes, assigns and resolves.', true, false);

-- ---------------------------------------------------------------------------
-- cities — the location model. Calabar goes live first; every other row is
-- pre-seeded but not live, so multi-city expansion is a data change.
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state text not null,
  country text not null default 'Nigeria',
  timezone text not null default 'Africa/Lagos',
  is_live boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index cities_is_live_idx on public.cities (is_live);

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users row, created by trigger on signup.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer' references public.roles (key),
  full_name text not null default '',
  email text not null,
  phone text,
  avatar_url text,
  default_city_id uuid references public.cities (id) on delete set null,
  default_area text,
  is_suspended boolean not null default false,
  suspension_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- addresses — customer saved addresses
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  street_address text not null,
  area text,
  landmark text,
  city_id uuid references public.cities (id) on delete set null,
  contact_name text,
  contact_phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_profile_idx on public.addresses (profile_id);
create unique index addresses_single_default_idx
  on public.addresses (profile_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- task_categories
-- ---------------------------------------------------------------------------

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  icon text not null default 'Sparkles',
  examples text[] not null default '{}',
  requires_proof boolean not null default true,
  typical_service_fee_kobo bigint not null default 0 check (typical_service_fee_kobo >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks — the centre of the domain
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.task_categories (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text not null check (char_length(btrim(description)) between 20 and 4000),
  additional_instructions text,
  status public.task_status not null default 'draft',
  urgency public.task_urgency not null default 'standard',
  city_id uuid references public.cities (id) on delete set null,
  location_area text,
  location_address text not null,
  location_landmark text,
  destination_required boolean not null default false,
  destination_area text,
  destination_address text,
  contact_phone text,
  preferred_date date,
  preferred_time_slot text,
  budget_kobo bigint check (budget_kobo is null or budget_kobo >= 0),
  requires_proof boolean not null default true,
  interpretation jsonb,
  is_demo boolean not null default false,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  quoted_at timestamptz,
  paid_at timestamptz,
  assigned_at timestamptz,
  started_at timestamptz,
  proof_submitted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_destination_present check (
    destination_required = false or btrim(coalesce(destination_address, '')) <> ''
  )
);

create index tasks_customer_idx on public.tasks (customer_id, created_at desc);
create index tasks_status_idx on public.tasks (status);
create index tasks_category_idx on public.tasks (category_id);
create index tasks_city_idx on public.tasks (city_id);
create index tasks_created_at_idx on public.tasks (created_at desc);
create index tasks_reference_trgm_idx on public.tasks (lower(reference));

-- ---------------------------------------------------------------------------
-- task_attachments — files the customer attaches to a request, or evidence
-- attached to a dispute. Proof-of-completion lives in task_proofs.
-- ---------------------------------------------------------------------------

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  dispute_id uuid,
  uploaded_by uuid references public.profiles (id) on delete set null,
  kind public.attachment_kind not null default 'request',
  bucket text not null default 'task-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id);
create index task_attachments_dispute_idx on public.task_attachments (dispute_id);

-- ---------------------------------------------------------------------------
-- task_quotes — transparent price breakdown. total_kobo is generated so the
-- total can never drift from its components.
-- ---------------------------------------------------------------------------

create table public.task_quotes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  service_fee_kobo bigint not null default 0 check (service_fee_kobo >= 0),
  transport_fee_kobo bigint not null default 0 check (transport_fee_kobo >= 0),
  additional_fee_kobo bigint not null default 0 check (additional_fee_kobo >= 0),
  additional_fee_note text,
  platform_fee_kobo bigint not null default 0 check (platform_fee_kobo >= 0),
  total_kobo bigint generated always as (
    service_fee_kobo + transport_fee_kobo + additional_fee_kobo + platform_fee_kobo
  ) stored,
  agent_payout_kobo bigint not null default 0 check (agent_payout_kobo >= 0),
  status public.quote_status not null default 'sent',
  notes text,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  responded_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_quotes_additional_note check (
    additional_fee_kobo = 0 or btrim(coalesce(additional_fee_note, '')) <> ''
  )
);

create index task_quotes_task_idx on public.task_quotes (task_id, created_at desc);
-- At most one quote awaiting a customer decision per task.
create unique index task_quotes_single_open_idx
  on public.task_quotes (task_id)
  where status = 'sent';

-- ---------------------------------------------------------------------------
-- payments — one row per payment attempt. Status is only ever advanced by
-- server-side verification (provider API or signed webhook), never by a
-- client-supplied value.
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  quote_id uuid references public.task_quotes (id) on delete set null,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  provider public.payment_provider not null,
  reference text not null unique,
  provider_reference text,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  authorization_url text,
  channel text,
  paid_at timestamptz,
  failure_reason text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_task_idx on public.payments (task_id, created_at desc);
create index payments_customer_idx on public.payments (customer_id);
create index payments_status_idx on public.payments (status);

-- ---------------------------------------------------------------------------
-- agents + verification + service areas
-- ---------------------------------------------------------------------------

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  headline text,
  bio text,
  transport_mode text,
  verification_status public.verification_status not null default 'pending',
  is_available boolean not null default true,
  max_active_tasks integer not null default 3 check (max_active_tasks between 1 and 10),
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_tasks integer not null default 0 check (completed_tasks >= 0),
  cancelled_tasks integer not null default 0 check (cancelled_tasks >= 0),
  accepted_assignments integer not null default 0 check (accepted_assignments >= 0),
  released_assignments integer not null default 0 check (released_assignments >= 0),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_verification_idx on public.agents (verification_status);
create index agents_available_idx on public.agents (is_available);

create table public.agent_verifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  status public.verification_status not null default 'pending',
  transport_mode text not null,
  availability text not null,
  experience text,
  motivation text,
  referee_name text,
  referee_phone text,
  consents_to_checks boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_verifications is
  'Operational vetting only. The MVP deliberately does not collect or store ID numbers, BVN, bank details or scanned identity documents.';

create index agent_verifications_agent_idx on public.agent_verifications (agent_id, created_at desc);
create index agent_verifications_status_idx on public.agent_verifications (status);

create table public.agent_service_areas (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  area_name text not null,
  created_at timestamptz not null default now(),
  unique (agent_id, city_id, area_name)
);

create index agent_service_areas_city_idx on public.agent_service_areas (city_id);

-- ---------------------------------------------------------------------------
-- task_assignments — history of who was put on a task. Exactly one active
-- assignment per task, enforced by a partial unique index.
-- ---------------------------------------------------------------------------

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'active',
  agent_payout_kobo bigint not null default 0 check (agent_payout_kobo >= 0),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  released_at timestamptz,
  release_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index task_assignments_single_active_idx
  on public.task_assignments (task_id)
  where status = 'active';
create index task_assignments_agent_idx on public.task_assignments (agent_id, created_at desc);
create index task_assignments_task_idx on public.task_assignments (task_id);

-- ---------------------------------------------------------------------------
-- task_status_history — append-only audit trail powering the customer timeline
-- ---------------------------------------------------------------------------

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  actor_role public.user_role,
  note text,
  created_at timestamptz not null default now()
);

create index task_status_history_task_idx on public.task_status_history (task_id, created_at);

-- ---------------------------------------------------------------------------
-- task_messages — scoped to a task, not an open social inbox
-- ---------------------------------------------------------------------------

create table public.task_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index task_messages_task_idx on public.task_messages (task_id, created_at);

-- ---------------------------------------------------------------------------
-- task_proofs — proof of completion. A file is required unless the proof is a
-- text confirmation, in which case a meaningful note is required.
-- ---------------------------------------------------------------------------

create table public.task_proofs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  proof_type public.proof_type not null,
  note text,
  bucket text not null default 'task-proofs',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes > 0 and size_bytes <= 52428800)),
  created_at timestamptz not null default now(),
  constraint task_proofs_file_required check (
    proof_type = 'text' or storage_path is not null
  ),
  constraint task_proofs_note_required check (
    proof_type <> 'text' or char_length(btrim(coalesce(note, ''))) >= 10
  )
);

create index task_proofs_task_idx on public.task_proofs (task_id, created_at);

-- ---------------------------------------------------------------------------
-- notifications — in-app feed. External channels (email/SMS/WhatsApp) are
-- fanned out by the notification service, not stored here.
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  task_id uuid references public.tasks (id) on delete cascade,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  raised_by uuid not null references public.profiles (id) on delete cascade,
  reason public.dispute_reason not null,
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index disputes_task_idx on public.disputes (task_id, created_at desc);
create index disputes_status_idx on public.disputes (status);
create unique index disputes_single_open_idx
  on public.disputes (task_id)
  where status in ('open', 'under_review');

alter table public.task_attachments
  add constraint task_attachments_dispute_fk
  foreign key (dispute_id) references public.disputes (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- reviews — one review per completed task
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index reviews_agent_idx on public.reviews (agent_id, created_at desc);
