-- In-app messages (envelope on the parent dashboard)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_household_created_idx ON notifications (household_id, created_at DESC);

-- Parents can only see and mark-as-read their own family's messages. Messages are created by the server.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_read_own_notifications" ON notifications;
CREATE POLICY "parents_read_own_notifications" ON notifications FOR SELECT TO authenticated
  USING (household_id IN (SELECT id FROM households WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "parents_mark_own_notifications_read" ON notifications;
CREATE POLICY "parents_mark_own_notifications_read" ON notifications FOR UPDATE TO authenticated
  USING (household_id IN (SELECT id FROM households WHERE user_id = auth.uid()))
  WITH CHECK (household_id IN (SELECT id FROM households WHERE user_id = auth.uid()));
