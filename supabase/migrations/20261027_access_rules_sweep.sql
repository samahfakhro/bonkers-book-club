-- Code sweep (27 Oct): tables the browser uses whose access rules were missing or too open.
-- Server routes use the service key and are not affected.

-- A. subscriptions: had RLS on with NO policies, so Settings, the library allowance, the "membership ended"
--    screen and Admin → Members plan changes all quietly failed.
--    Families read their own membership; team admins read all and can update (Admin → Members).
alter table subscriptions enable row level security;

drop policy if exists families_read_own_subscriptions on subscriptions;
create policy families_read_own_subscriptions on subscriptions for select
  using (household_id in (select id from households where user_id = auth.uid()));

drop policy if exists admin_read_all_subscriptions on subscriptions;
create policy admin_read_all_subscriptions on subscriptions for select using (public.is_team_admin());

drop policy if exists admin_update_subscriptions on subscriptions;
create policy admin_update_subscriptions on subscriptions for update
  using (public.is_team_admin()) with check (public.is_team_admin());

-- B. subscription_plans: no policies, so plan names and book counts came back empty. Plans aren't private.
alter table subscription_plans enable row level security;

drop policy if exists public_read_subscription_plans on subscription_plans;
create policy public_read_subscription_plans on subscription_plans for select using (true);

-- C. series: no policies, so series pages couldn't show sub-series. Series aren't private.
alter table series enable row level security;

drop policy if exists public_read_series on series;
create policy public_read_series on series for select using (true);

-- D. book_copies: no rule for adding, so Admin → Books "Add copy" failed. Team admins may add copies.
drop policy if exists admin_insert_book_copies on book_copies;
create policy admin_insert_book_copies on book_copies for insert with check (public.is_team_admin());

-- E. book_categories: RLS was OFF, so anyone with the public key could add or delete categories on books.
--    Everyone reads; only team admins change.
alter table book_categories enable row level security;

drop policy if exists public_read_book_categories on book_categories;
create policy public_read_book_categories on book_categories for select using (true);

drop policy if exists admin_write_book_categories on book_categories;
create policy admin_write_book_categories on book_categories for all
  using (public.is_team_admin()) with check (public.is_team_admin());

-- F. book_reading_levels (Hatchlings / Chicks / Birds on each book): "Auth write" let ANY signed-in family
--    change them. Everyone still reads ("Public read" stays); only team admins change (Admin → Books).
drop policy if exists "Auth write" on book_reading_levels;

drop policy if exists admin_write_book_reading_levels on book_reading_levels;
create policy admin_write_book_reading_levels on book_reading_levels for all
  using (public.is_team_admin()) with check (public.is_team_admin());
