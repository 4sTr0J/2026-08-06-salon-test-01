-- ─── Cancellation Policies ────────────────────────────────────────────────────
-- Stores adjustable cancellation policies set by salon owners.
-- policy_type: 'flexible' | 'moderate' | 'limited'
-- Preset defaults:
--   flexible  → 100% refund, 24 h window
--   moderate  → 50%  refund, 48 h window
--   limited   → 0%   refund, 72 h window
create table if not exists public.cancellation_policies (
  id                         uuid    primary key default gen_random_uuid(),
  salon_id                   uuid    not null references auth.users(id) on delete cascade,
  policy_type                text    not null check (policy_type in ('flexible', 'moderate', 'limited')),
  refund_percentage          integer not null check (refund_percentage >= 0 and refund_percentage <= 100),
  cancellation_window_hours  integer not null check (cancellation_window_hours >= 0),
  description                text,
  is_active                  boolean not null default true,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.cancellation_policies enable row level security;

-- Only the salon owner can view their own policies
drop policy if exists "Cancellation policies are viewable by owner" on public.cancellation_policies;
create policy "Cancellation policies are viewable by owner"
on public.cancellation_policies
for select
using (auth.uid() = salon_id);

-- Only the salon owner can insert their own policies
drop policy if exists "Cancellation policies can be inserted by owner" on public.cancellation_policies;
create policy "Cancellation policies can be inserted by owner"
on public.cancellation_policies
for insert
with check (auth.uid() = salon_id);

-- Only the salon owner can update their own policies
drop policy if exists "Cancellation policies can be updated by owner" on public.cancellation_policies;
create policy "Cancellation policies can be updated by owner"
on public.cancellation_policies
for update
using (auth.uid() = salon_id)
with check (auth.uid() = salon_id);

-- Only the salon owner can delete their own policies
drop policy if exists "Cancellation policies can be deleted by owner" on public.cancellation_policies;
create policy "Cancellation policies can be deleted by owner"
on public.cancellation_policies
for delete
using (auth.uid() = salon_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

drop trigger if exists cancellation_policies_set_updated_at on public.cancellation_policies;
create trigger cancellation_policies_set_updated_at
before update on public.cancellation_policies
for each row
execute function public.handle_updated_at();
