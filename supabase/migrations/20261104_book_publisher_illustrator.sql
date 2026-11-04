-- Admin-only catalogue details, filled in from the ISBN lookup (Google Books / Open Library) and editable.
alter table books add column if not exists publisher text;
alter table books add column if not exists illustrator text;
alter table books add column if not exists publication_date text;   -- as printed, e.g. "2004" or "16 August 2007"

-- Library search: title, author, book type, tags, illustrator and publisher (publisher/illustrator aren't shown
-- to families, but they can search by them). Runs with the caller's own access rules, so only active books come back.
create or replace function search_books(q text)
returns setof books
language sql stable
set search_path = public
as $$
  select * from books b
  where b.is_active
    and length(trim(q)) > 0
    and (
      b.title ilike '%' || trim(q) || '%'
      or b.author ilike '%' || trim(q) || '%'
      or b.book_type ilike '%' || trim(q) || '%'
      or b.illustrator ilike '%' || trim(q) || '%'
      or b.publisher ilike '%' || trim(q) || '%'
      or exists (select 1 from unnest(coalesce(b.search_tags, '{}')) t where t ilike '%' || trim(q) || '%')
    )
  order by (b.title ilike trim(q) || '%') desc, b.title
  limit 20
$$;
