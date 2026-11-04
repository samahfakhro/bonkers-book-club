-- Fiction / non-fiction is separate from the format (a flap book can be non-fiction).
-- Admin-only: not shown on the book page, but "non-fiction" in the search bar finds these books.
alter table books add column if not exists is_non_fiction boolean not null default false;

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
      or (b.is_non_fiction and (
            'non-fiction' like replace(lower(trim(q)), ' ', '-') || '%'
            or 'nonfiction' like lower(trim(q)) || '%'
            or lower(trim(q)) in ('fact', 'facts', 'factual', 'true', 'true stories')))
    )
  order by (b.title ilike trim(q) || '%') desc, b.title
  limit 20
$$;
