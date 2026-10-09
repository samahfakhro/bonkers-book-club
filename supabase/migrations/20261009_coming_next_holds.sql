-- Undelivered books now go back on the normal shelves (no special reserved shelf).
drop trigger if exists release_reserved_copy on swap_request_items;
drop function if exists release_reserved_copy_on_item_delete();
update book_copies set status = 'available', current_household_id = null where status = 'reserved';

-- A book in a family's Coming Next list holds a copy for them.
-- Returns the books the CALLING family can still add: copies on the shelf minus copies held by other families.
-- (Copies already packed into an envelope aren't on the shelf, so they're not counted twice.)
create or replace function available_books(p_book_ids uuid[] default null)
returns table(book_id uuid, free_copies int)
language sql stable security definer set search_path = public as $$
  with me as (select id from households where user_id = auth.uid() limit 1),
  shelf as (
    select c.book_id, count(*) as n from book_copies c
    where c.status = 'available' and (p_book_ids is null or c.book_id = any(p_book_ids))
    group by c.book_id
  ),
  held as (
    select i.book_id, count(*) as n
    from swap_request_items i join swap_requests r on r.id = i.swap_request_id
    where i.book_id is not null and i.packed_copy_id is null
      and r.status in ('draft', 'child_confirmed', 'submitted', 'awaiting_approval', 'approved', 'locked', 'delivery_failed')
      and r.household_id is distinct from (select id from me)
      and (p_book_ids is null or i.book_id = any(p_book_ids))
    group by i.book_id
  )
  select s.book_id, (s.n - coalesce(h.n, 0))::int
  from shelf s left join held h on h.book_id = s.book_id
  where s.n - coalesce(h.n, 0) > 0
$$;

grant execute on function available_books(uuid[]) to anon, authenticated;
