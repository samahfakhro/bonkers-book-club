-- Missed visits: backup delivery permissions + the family's reply to a missed delivery/collection.

-- Backups a family is happy with if nobody answers (neighbour permission/details already exist)
ALTER TABLE households ADD COLUMN IF NOT EXISTS backup_safe_drop boolean NOT NULL DEFAULT false;
ALTER TABLE households ADD COLUMN IF NOT EXISTS backup_concierge boolean NOT NULL DEFAULT false;

-- The family's reply from the Manage Delivery page (valid until the route closes)
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS family_response text;          -- retry_today | neighbour | concierge | safe_drop | next_bonkers_day
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS family_response_details text;  -- neighbour name/villa, safe spot description
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS family_responded_at timestamptz;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
