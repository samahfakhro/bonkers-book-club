-- Undelivered books sit on the RESERVED shelf for their family (book_copies.status = 'reserved').
-- If the family takes that book off their list, free one reserved copy for everyone else.
create or replace function release_reserved_copy_on_item_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  select household_id into hh from swap_requests where id = old.swap_request_id;
  if hh is null or old.book_id is null then return old; end if;
  -- only if they don't still have this book in another of their lists
  if exists (select 1 from swap_request_items i join swap_requests r on r.id = i.swap_request_id
             where r.household_id = hh and i.book_id = old.book_id and i.id <> old.id and r.status <> 'delivered') then
    return old;
  end if;
  update book_copies set status = 'available', current_household_id = null, updated_at = now()
  where id = (select id from book_copies where status = 'reserved' and current_household_id = hh and book_id = old.book_id limit 1);
  return old;
end $$;

drop trigger if exists release_reserved_copy on swap_request_items;
create trigger release_reserved_copy after delete on swap_request_items
  for each row execute function release_reserved_copy_on_item_delete();
