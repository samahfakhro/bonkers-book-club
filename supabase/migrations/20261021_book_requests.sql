-- Families (parents or kids) ask for books or series that aren't in the library yet.
-- Managed in Admin → Book Requests; requests for the same title are grouped by title_key.
create table if not exists book_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid references child_profiles(id) on delete set null,
  title text not null,
  title_key text not null,          -- lower-case title without "the"/punctuation, for grouping
  author text,
  note text,
  status text not null default 'new' check (status in ('new', 'ordered', 'added', 'not_adding')),
  book_id uuid references books(id) on delete set null,   -- the library book once it's added
  notified_at timestamptz,
  child_seen_at timestamptz,         -- when the child saw their "Your wish came true!" card
  created_at timestamptz not null default now()
);
create index if not exists book_requests_title_key on book_requests (title_key);
-- only the server (admin + the request API) touches this table
alter table book_requests enable row level security;
alter table book_requests add column if not exists child_seen_at timestamptz;
