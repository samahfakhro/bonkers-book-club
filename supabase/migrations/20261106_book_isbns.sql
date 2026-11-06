-- Every barcode ever scanned for a book, one row per barcode (a book can have several editions on the shelf).
-- Scanning any of them later finds the right book straight away. ol_work_key is Open Library's record shared by
-- all editions of a title, used to spot "same book, different edition" when a new barcode is scanned.
-- Only the server (service role, behind the team sign-in) reads and writes it: RLS on, no public policies.

create table if not exists book_isbns (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  isbn text not null unique,
  ol_work_key text,
  created_at timestamptz not null default now()
);
create index if not exists book_isbns_book_id_idx on book_isbns(book_id);
create index if not exists book_isbns_work_idx on book_isbns(ol_work_key);
alter table book_isbns enable row level security;
