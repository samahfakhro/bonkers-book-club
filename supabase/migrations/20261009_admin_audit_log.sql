-- Admin audit log: records sensitive admin actions such as 'log in as this family'
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action text NOT NULL,
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
