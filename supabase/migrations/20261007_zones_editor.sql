-- Delivery zones become the single source of truth for delivery day + cutoff (replacing communities)

-- 1. Zone code (Z1…Z6), per-zone cutoff time, and which drawing version is live
ALTER TABLE zones ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS cutoff_time text NOT NULL DEFAULT '20:00';
ALTER TABLE zones ADD COLUMN IF NOT EXISTS version text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS zones_code_key ON zones (code);

-- Delivery day is assigned later, so it may be empty for now
ALTER TABLE zones ALTER COLUMN bonkers_day DROP NOT NULL;

-- 2. Anyone (signup, dashboard) can read zones; only the server (service role) can change them
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zones_read_all" ON zones;
CREATE POLICY "zones_read_all" ON zones FOR SELECT USING (true);
