ALTER TABLE households
  ADD COLUMN IF NOT EXISTS swap_reminders boolean NOT NULL DEFAULT true;
