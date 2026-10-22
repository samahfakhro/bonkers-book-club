-- Families rank their delivery & collection options (1st choice first).
-- delivery_preference keeps choice #1 so older code keeps working.
alter table households add column if not exists delivery_preferences text[];
update households set delivery_preferences = array[delivery_preference]
  where delivery_preferences is null and delivery_preference is not null;
