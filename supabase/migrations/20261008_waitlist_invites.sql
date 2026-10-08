-- Waitlist invites: track when a family was invited and when they joined
-- status: waiting → invited → joined (or removed)
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS invited_at timestamptz;
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS joined_at timestamptz;
ALTER TABLE waitlist_signup ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE SET NULL;
