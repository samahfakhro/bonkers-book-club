-- Library search (11 Nov 2026):
--  * also finds books by their CATEGORY, including other words for it (e.g. "scary" → Spooky, "hilarious" → Funny)
--  * returns EVERY match (the old version stopped at 20)

-- 1. other words families might type for each category
alter table categories add column if not exists search_terms text[] not null default '{}';

update categories set search_terms = case name
  when 'Adventure'  then array['adventures', 'quest', 'quests', 'explore', 'exploring', 'journey']
  when 'Magic'      then array['magical', 'wizard', 'wizards', 'witch', 'witches', 'spells', 'fantasy']
  when 'Friendship' then array['friends', 'friend', 'best friends']
  when 'Funny'      then array['hilarious', 'humour', 'humor', 'silly', 'jokes', 'laugh', 'comedy', 'comedies']
  when 'Science'    then array['scientific', 'stem', 'experiments', 'scientists']
  when 'Facts'      then array['fact', 'non-fiction', 'nonfiction', 'information', 'true']
  when 'Mystery'    then array['mysteries', 'detective', 'detectives', 'whodunnit', 'clues']
  when 'Animals'    then array['animal']
  when 'Spooky'     then array['scary', 'creepy', 'horror', 'halloween', 'frightening', 'spine-chilling']
  else search_terms end;

-- 2. the search itself
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
      -- categories: the name or one of its other words ("scary", or "scary books" both find Spooky)
      or exists (select 1 from book_categories bc join categories c on c.id = bc.category_id
                 where bc.book_id = b.id and c.is_active
                   and (c.name ilike '%' || trim(q) || '%'
                        or trim(q) ~* ('\m' || c.name || '\M')          -- whole word inside a longer search
                        or exists (select 1 from unnest(c.search_terms) w
                                   where w ilike '%' || trim(q) || '%' or trim(q) ~* ('\m' || w || '\M'))))
    )
  order by (b.title ilike trim(q) || '%') desc, b.title
$$;
