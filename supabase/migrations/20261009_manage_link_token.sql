-- No-login Manage Delivery links: each visit gets an unguessable token used in the WhatsApp/email link.
-- The link only works until the route closes (checked in the app).
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS route_stops_manage_token_key ON route_stops (manage_token);
