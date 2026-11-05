-- Collectibles a child unlocks by reading: one per returned book (a reread earns another).
-- They arrive wrapped (an egg for creatures, a parcel for everything else, picked at random), the child opens it
-- and drags it into their Universe. Once it's out, it's out (no putting it back).
-- (Named child_collectibles: an older, empty child_universe_items table from the first Universe plan is left untouched.)

alter table books add column if not exists collectible_kind text not null default 'thing';   -- 'creature' hatches from an egg, 'thing' comes in a parcel

create table if not exists child_collectibles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references child_profiles(id) on delete cascade,
  book_id uuid references books(id) on delete set null,
  loan_id uuid unique references loans(id) on delete set null,
  name text not null,
  image_url text not null,
  lore text,
  kind text not null default 'thing' check (kind in ('creature', 'thing')),
  wrapper text not null,                 -- egg-1..3 / parcel-1..3 (public/universe/<wrapper>.png)
  pos_x real,                            -- where it sits, as % of the Universe picture; null = not placed yet
  pos_y real,
  unlocked_at timestamptz not null default now(),
  opened_at timestamptz,
  placed_at timestamptz
);
create index if not exists child_collectibles_child on child_collectibles(child_id);

-- unlock when a book is checked back in (the same moment it lands on Bonky's shelf)
create or replace function unlock_universe_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  if new.status <> 'returned' or old.status is not distinct from new.status or new.child_id is null then return null; end if;
  select bk.id, bk.collectible_name, bk.collectible_image_url, bk.collectible_lore, bk.collectible_kind into b
    from book_copies c join books bk on bk.id = c.book_id
   where c.id = new.book_copy_id and bk.collectible_status = 'approved' and bk.collectible_image_url is not null;
  if b.id is null then return null; end if;
  insert into child_collectibles (child_id, book_id, loan_id, name, image_url, lore, kind, wrapper)
  values (new.child_id, b.id, new.id, b.collectible_name, b.collectible_image_url, b.collectible_lore,
          coalesce(b.collectible_kind, 'thing'),
          (case when b.collectible_kind = 'creature' then 'egg-' else 'parcel-' end) || (1 + floor(random() * 3))::int)
  on conflict (loan_id) do nothing;
  return null;
end $$;
drop trigger if exists unlock_universe_item on loans;
create trigger unlock_universe_item after update of status on loans
  for each row execute function unlock_universe_item();

-- access: families see and move their own children's items; nobody creates or deletes them from the browser
alter table child_collectibles enable row level security;
drop policy if exists families_read_own_collectibles on child_collectibles;
create policy families_read_own_collectibles on child_collectibles for select
  using (child_id in (select cp.id from child_profiles cp join households h on h.id = cp.household_id where h.user_id = auth.uid()));
drop policy if exists families_move_own_collectibles on child_collectibles;
create policy families_move_own_collectibles on child_collectibles for update
  using (child_id in (select cp.id from child_profiles cp join households h on h.id = cp.household_id where h.user_id = auth.uid()))
  with check (child_id in (select cp.id from child_profiles cp join households h on h.id = cp.household_id where h.user_id = auth.uid()));
drop policy if exists admin_read_collectibles on child_collectibles;
create policy admin_read_collectibles on child_collectibles for select using (is_team_admin());
revoke insert, update, delete on child_collectibles from anon, authenticated;
grant select on child_collectibles to authenticated;
grant update (opened_at, placed_at, pos_x, pos_y) on child_collectibles to authenticated;
