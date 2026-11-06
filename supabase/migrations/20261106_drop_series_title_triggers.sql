-- The per-series tick-box is replaced by "Series Number: Book name" for every new book in a series (done when the book
-- is added in Admin → Books). Stop the old database rule; existing titles stay exactly as they are.
drop trigger if exists books_series_title_prefix on books;
drop trigger if exists series_name_in_title_trg on series;
