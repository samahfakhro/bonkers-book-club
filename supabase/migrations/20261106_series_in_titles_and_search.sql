-- 1. "Put the series name in front of titles" (a tick-box per series in Admin → Books).
--    When a series (or its parent series) has it on, every book in it is titled "Series: Book", e.g. "Goosebumps: Monster Blood".
--    Done by the database itself, so it holds however a book is added or edited.
alter table series add column if not exists name_in_title boolean not null default false;

-- the series name a book's title should start with (the parent's if the parent has it on, e.g. HorrorLand → Goosebumps)
create or replace function series_title_prefix(p_series uuid) returns text
language sql stable set search_path = public as $$
  select coalesce(case when p.name_in_title then p.name end, case when s.name_in_title then s.name end)
  from series s left join series p on p.id = s.parent_series_id
  where s.id = p_series
$$;

-- "Goosebumps - Return of the Mummy" / "Goosebumps: Return of the Mummy" / "Return of the Mummy" → "Return of the Mummy"
create or replace function strip_series_prefix(p_title text, p_name text) returns text
language sql immutable as $$
  select trim(regexp_replace(p_title, '^' || regexp_replace(p_name, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\s*[:\-–—]?\s*', '', 'i'))
$$;

create or replace function apply_series_title_prefix() returns trigger
language plpgsql set search_path = public as $$
declare prefix text; rest text;
begin
  if new.series_id is null then return new; end if;
  prefix := series_title_prefix(new.series_id);
  if prefix is null then return new; end if;
  rest := strip_series_prefix(new.title, prefix);
  if rest = '' then return new; end if;
  new.title := prefix || ': ' || rest;
  return new;
end $$;

drop trigger if exists books_series_title_prefix on books;
create trigger books_series_title_prefix before insert or update of title, series_id on books
  for each row execute function apply_series_title_prefix();

-- ticking / unticking the box updates the titles already in that series (and its sub-series)
create or replace function series_name_in_title_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.name_in_title is distinct from old.name_in_title then
    if new.name_in_title then
      update books set title = title   -- the books trigger adds the prefix
        where series_id = new.id or series_id in (select id from series where parent_series_id = new.id);
    else
      update books set title = strip_series_prefix(title, old.name)
        where series_id = new.id or series_id in (select id from series where parent_series_id = new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists series_name_in_title_trg on series;
create trigger series_name_in_title_trg after update of name_in_title on series
  for each row execute function series_name_in_title_changed();

-- 2. Library search also matches the series and sub-series name (e.g. "goosebumps" finds every Goosebumps book)
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
      or exists (select 1 from series s left join series p on p.id = s.parent_series_id
                 where s.id = b.series_id and (s.name ilike '%' || trim(q) || '%' or p.name ilike '%' || trim(q) || '%'))
    )
  order by (b.title ilike trim(q) || '%') desc, b.title
  limit 20
$$;

-- 3. Goosebumps: names in titles, and the Hall of Horrors books get their own sub-series
insert into series (name, parent_series_id)
  select 'Goosebumps Hall of Horrors', id from series where name = 'Goosebumps' and parent_series_id is null
  and not exists (select 1 from series where name = 'Goosebumps Hall of Horrors');
update books set title = 'The Birthday Party of No Return',
    series_id = (select id from series where name = 'Goosebumps Hall of Horrors' limit 1), series_number = 6
  where title = 'The Birthday Party of No Return!' and isbn = '9780545289382';
update series set name_in_title = true where name = 'Goosebumps' and parent_series_id is null;
