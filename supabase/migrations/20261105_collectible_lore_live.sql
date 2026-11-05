-- A collectible's lore line is written by the AI as a suggestion only. Children see it once a team member has
-- reviewed it (and edited it if they like) and pressed Publish in Admin → Books.
alter table books add column if not exists collectible_lore_live boolean not null default false;
