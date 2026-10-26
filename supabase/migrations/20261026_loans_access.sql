-- loans had row level security switched on but NO policies, so families couldn't see any of their loans:
-- Books at home, Books I've Read, Bonky's shelf and the Returning tick were all empty / failing.
-- Families: read their own household's loans, and change only the Returning tick. Team admins: read all.
-- Everything else (creating loans, check-in, status changes) stays server-side with the service key.

alter table loans enable row level security;

drop policy if exists families_read_own_loans on loans;
create policy families_read_own_loans on loans for select
  using (household_id in (select id from households where user_id = auth.uid()));

drop policy if exists families_mark_returning on loans;
create policy families_mark_returning on loans for update
  using (household_id in (select id from households where user_id = auth.uid()))
  with check (household_id in (select id from households where user_id = auth.uid()));

drop policy if exists admin_read_all_loans on loans;
create policy admin_read_all_loans on loans for select using (is_team_admin());

-- the only column a family can change is return_requested
revoke insert, update, delete on loans from anon, authenticated;
grant select on loans to authenticated;
grant update (return_requested) on loans to authenticated;
