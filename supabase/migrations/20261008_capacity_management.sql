-- Capacity management for the pilot: manual caps + pauses (enforced at signup), waitlist demand data
-- Already run in Supabase on 2026-10-07. Empty (or 0) cap = no limit.

-- Zone caps + pause
ALTER TABLE zones ADD COLUMN IF NOT EXISTS membership_cap integer;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

-- Global cap + pause
INSERT INTO system_settings (key, value, description) VALUES
  ('global_membership_cap', '50', 'Maximum active Bonkers memberships'),
  ('global_memberships_paused', 'false', 'Pause all new memberships')
ON CONFLICT (key) DO NOTHING;

-- Waitlist demand data
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id);
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'waiting';
