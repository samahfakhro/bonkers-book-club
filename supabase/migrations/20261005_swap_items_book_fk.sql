ALTER TABLE swap_request_items
  ADD CONSTRAINT IF NOT EXISTS fk_swap_items_book_id
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
