-- Team: who can use admin, driver and warehouse screens (managed in Admin → Team).
-- Staff without email log in with mobile + password; their login email is a hidden t<digits>@team.curiouslibrary.ae.
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text,                       -- digits, e.g. 971501234567
  email text,                       -- real email, or the hidden login email
  role text not null check (role in ('admin', 'driver', 'warehouse')),
  is_owner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table team_members enable row level security;

-- each person can read their own row (the screens use it to know what to show)
drop policy if exists team_read_own on team_members;
create policy team_read_own on team_members for select using (user_id = auth.uid());

-- true for an active admin — used by the database rules below
create or replace function public.is_team_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where user_id = auth.uid() and active and role = 'admin')
$$;

-- Samah is the owner (can't be removed or switched off)
insert into team_members (user_id, name, email, role, is_owner)
select id, 'Samah', email, 'admin', true from auth.users where lower(email) = 'samahfakhro@gmail.com'
on conflict (user_id) do nothing;

-- admin read/update rules now follow the team list instead of one email
alter policy admin_read_all_households on households using (public.is_team_admin());
alter policy admin_read_all_child_profiles on child_profiles using (public.is_team_admin());
alter policy admin_read_all_swap_requests on swap_requests using (public.is_team_admin());
alter policy admin_read_all_swap_request_items on swap_request_items using (public.is_team_admin());
alter policy admin_read_all_damage_charges on damage_charges using (public.is_team_admin());
alter policy admin_update_book_copies on book_copies using (public.is_team_admin()) with check (public.is_team_admin());
