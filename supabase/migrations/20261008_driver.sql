-- Driver app: remember exactly which copy went into each envelope at packing (so delivery can create the
-- family's loans), and a private storage bucket for safe-drop photos.

ALTER TABLE swap_request_items ADD COLUMN IF NOT EXISTS packed_copy_id uuid REFERENCES book_copies(id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', false)
ON CONFLICT (id) DO NOTHING;
