-- Route-based delivery: Zone + Delivery date → Route → Stops (one per family visit).
-- Packing order, boxes of 25, labels and the driver's sequence are all derived from route_stops.stop_order.

-- 1. Routes belong to a zone + date; draft → locked → completed
ALTER TABLE routes ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id);
ALTER TABLE routes ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS start_lat double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS start_lng double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS optimised_with text;          -- 'google' | 'built_in' | 'manual'
ALTER TABLE routes ADD COLUMN IF NOT EXISTS total_distance_m integer;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS total_duration_s integer;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS routes_zone_date_idx ON routes (zone_id, route_date);

-- 2. Stops: one per family visit. stop_order is the stop number (Z3-001) and never changes once locked.
--    visit_ref (D-10001…) is permanent and never reused — for support, messages and returns.
CREATE SEQUENCE IF NOT EXISTS visit_ref_seq START 10001;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS visit_ref text DEFAULT ('D-' || nextval('visit_ref_seq'));
CREATE UNIQUE INDEX IF NOT EXISTS route_stops_visit_ref_key ON route_stops (visit_ref);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS stop_type text;            -- 'delivery' | 'collection' | 'both'
ALTER TABLE route_stops ALTER COLUMN status SET DEFAULT 'to_pick';          -- to_pick | packed | done | cancelled
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS outcome text;              -- driver outcome (Appendix D)
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS outcome_notes text;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS latitude double precision; -- pin copied at generation, so address changes can't move a locked stop
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS packed_at timestamptz;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS route_stops_route_household_key ON route_stops (route_id, household_id);

-- 3. What each visit carries: the book choices it delivers and the books it collects
ALTER TABLE swap_requests ADD COLUMN IF NOT EXISTS route_stop_id uuid REFERENCES route_stops(id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS return_requested boolean NOT NULL DEFAULT false; -- the dashboard "returning" tick (column was missing)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS collection_stop_id uuid REFERENCES route_stops(id) ON DELETE SET NULL;

-- 4. Warehouse = start of every route
INSERT INTO system_settings (key, value, description)
SELECT v.key, v.value, v.description FROM (VALUES
  ('warehouse_address', 'Villa 29, Street 12, Saheel, Arabian Ranches 1', 'Start point of every delivery route'),
  ('warehouse_lat', '25.052733', 'Warehouse latitude'),
  ('warehouse_lng', '55.256031', 'Warehouse longitude')
) AS v(key, value, description)
WHERE NOT EXISTS (SELECT 1 FROM system_settings s WHERE s.key = v.key);

-- 5. Route data is only read/written by the server (admin + driver APIs use the service role)
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
