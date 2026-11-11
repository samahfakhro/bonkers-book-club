// The 7 book formats (books.book_type), agreed with Samah on 11 Nov 2026. Shared by the admin forms and the AI lookup,
// so new books are sorted the same way as the rest of the library.
export const BOOK_FORMATS = ['Board Book', 'Picture Book', 'Early Reader', 'Chapter Book', 'Graphic Novel', 'Novel', 'Non-fiction'] as const

export const BOOK_FORMAT_RULES = `- Board Book: thick card pages, for babies and toddlers (including lift-the-flap books for little ones).
- Picture Book: a story told mainly through pictures, read aloud, usually about 32 pages (e.g. Julia Donaldson, Mr. Men, Hairy Maclary).
- Early Reader: learn-to-read books with short, simple words (e.g. Fly Guy, Ladybird Read It Yourself, Dr. Seuss Beginner Books).
- Chapter Book: short chapters with pictures on most pages, about 60–150 pages, for children just starting to read alone (e.g. Claude, Horrid Henry, Eerie Elementary, The Worst Witch, Captain Underpants).
- Graphic Novel: told in comic panels (e.g. Dog Man, Bunny vs Monkey, Big Nate comics).
- Novel: longer, text-led fiction for confident readers, even when it has lots of pictures (e.g. Matilda, Harry Potter, David Walliams, Diary of a Wimpy Kid).
- Non-fiction: information, puzzle and activity books beyond picture-book age (e.g. 100 Things to Know, Horrible Histories, Usborne See Inside). A non-fiction board book or picture book for little ones stays Board Book / Picture Book.`
