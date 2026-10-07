ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES child_profiles(id) ON DELETE CASCADE;
