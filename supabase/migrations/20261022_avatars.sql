-- Avatars: Samah's illustrated set, one shared picker for children and parents.
-- child_profiles.avatar_id already references avatars(id); households had no avatar column at all,
-- so the parent's choice (and with it the whole Settings → Account save) was failing.

alter table avatars add column if not exists display_order int not null default 0;

alter table households add column if not exists avatar_id uuid references avatars(id) on delete set null;

-- everyone can see the list of avatars (it's just pictures)
alter table avatars enable row level security;
drop policy if exists "avatars are readable by everyone" on avatars;
create policy "avatars are readable by everyone" on avatars for select using (true);
