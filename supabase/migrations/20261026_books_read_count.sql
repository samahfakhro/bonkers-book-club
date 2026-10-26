-- "Books read" per child = their returned loans (the same books that sit on the shelf in Bonky's house).
-- Nothing ever updated child_profiles.books_read_count, so it was 0 for everyone. A trigger now keeps it right.

create or replace function refresh_books_read_count(p_child uuid) returns void
language sql security definer set search_path = public as $$
  update child_profiles
     set books_read_count = (select count(*) from loans where child_id = p_child and status = 'returned')
   where id = p_child;
$$;

create or replace function loans_books_read_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.child_id is not null then perform refresh_books_read_count(new.child_id); end if;
  if tg_op in ('UPDATE', 'DELETE') and old.child_id is not null and (tg_op = 'DELETE' or old.child_id is distinct from new.child_id) then
    perform refresh_books_read_count(old.child_id);
  end if;
  return null;
end;
$$;

drop trigger if exists loans_books_read_count on loans;
create trigger loans_books_read_count
  after insert or delete or update of status, child_id on loans
  for each row execute function loans_books_read_count();

-- put the existing numbers right
update child_profiles c
   set books_read_count = (select count(*) from loans l where l.child_id = c.id and l.status = 'returned');
