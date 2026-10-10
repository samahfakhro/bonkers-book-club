-- No grace period: a family with more books at home than their plan (found at the hub) can't choose
-- or submit new books until enough come back. They can still mark books as Returning (a collection).
create or replace function block_swaps_on_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('submitted', 'child_confirmed') and new.status is distinct from old.status
     and exists (select 1 from households h where h.id = new.household_id and h.over_allowance_since is not null) then
    raise exception 'NEW_BOOKS_ON_HOLD';
  end if;
  return new;
end $$;

create or replace function block_choices_on_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from swap_requests r join households h on h.id = r.household_id
             where r.id = new.swap_request_id and h.over_allowance_since is not null) then
    raise exception 'NEW_BOOKS_ON_HOLD';
  end if;
  return new;
end $$;

drop trigger if exists block_choices_on_hold on swap_request_items;
create trigger block_choices_on_hold before insert on swap_request_items
  for each row execute function block_choices_on_hold();
