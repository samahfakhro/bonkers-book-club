-- Collectibles in 3 steps: research the book → 3 ideas → draw the chosen one.
alter table books add column if not exists collectible_fact_sheet text;     -- what happens in the book (researched, editable)
alter table books add column if not exists collectible_notes text;          -- the curator's own notes about the book
alter table books add column if not exists collectible_options jsonb;       -- the 3 ideas to choose from

-- collectible_status gains 'fact_sheet' and 'options'; drop any old check constraint that only allowed the earlier values
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.books'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%collectible_status%'
  loop
    execute format('alter table books drop constraint %I', c.conname);
  end loop;
end $$;
