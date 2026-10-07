-- 1. Add swap_cutoff_time to communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS swap_cutoff_time text NOT NULL DEFAULT '20:00';

-- 2. RLS: only allow changes to swap_request_items while the request is still draft
--    (this fires on INSERT and DELETE)
ALTER TABLE swap_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_require_draft_request" ON swap_request_items;

CREATE POLICY "items_require_draft_request" ON swap_request_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM swap_requests
      WHERE swap_requests.id = swap_request_items.swap_request_id
        AND swap_requests.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swap_requests
      WHERE swap_requests.id = swap_request_items.swap_request_id
        AND swap_requests.status = 'draft'
    )
  );
