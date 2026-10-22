-- Half-finished sign-ups: saved once someone completes "About you", so we can send ONE friendly reminder
-- (about 24 hours later) with a link that brings their details back. Cleared out of reminders once they join.
create table if not exists signup_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  phone text,
  plan_id uuid,
  token uuid not null default gen_random_uuid(),   -- private link to resume / unsubscribe
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  reminded_at timestamptz,
  unsubscribed_at timestamptz
);
create unique index if not exists signup_leads_email on signup_leads (lower(email));
create unique index if not exists signup_leads_token on signup_leads (token);
alter table signup_leads enable row level security;   -- only the server touches it
