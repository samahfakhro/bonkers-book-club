-- Stripe billing + promo codes (28 Oct).
-- Promo codes are typed at sign-up. 'free' = membership with no card and no payment (e.g. trial families);
-- 'discount' = a Stripe coupon taken off the monthly payment for the first N months.
-- Server-only table: RLS on with no policies (the browser never reads it; the server uses the service key).

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- stored in capitals
  kind text not null check (kind in ('free', 'discount')),
  percent_off int check (percent_off between 1 and 100),
  duration_months int check (duration_months >= 1),
  stripe_coupon_id text,
  max_uses int check (max_uses >= 1),
  times_used int not null default 0,
  expires_on date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table promo_codes enable row level security;

-- which code a family joined with, and whether their membership is free (no Stripe billing)
alter table subscriptions add column if not exists promo_code text;
alter table subscriptions add column if not exists is_free boolean not null default false;

-- A family that signed up but hasn't finished paying ('pending_payment') can't choose books yet
create or replace function public.membership_inactive(p_household uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from subscriptions where household_id = p_household and status = 'active')
     and exists (select 1 from subscriptions where household_id = p_household and status in ('paused', 'cancelling', 'cancelled', 'pending_payment'))
$$;

-- the trial families' code: free membership, no card
insert into promo_codes (code, kind, note) values ('CURIOUSFRIENDS', 'free', 'Trial families: free membership, no card needed')
on conflict (code) do nothing;
