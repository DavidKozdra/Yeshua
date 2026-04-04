import { BIBLE_BOOKS } from './bibleData';

const BOOK_ALIASES = {
  genisis: 'GEN',
  genesis: 'GEN',
  psalm: 'PSA',
  psalms: 'PSA',
  songofsongs: 'SNG',
  songofsolomon: 'SNG',
  songsolomon: 'SNG',
};

function normalizeBookToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseReferenceInput(input) {
  if (typeof input !== 'string') return null;

  const match = input.trim().match(/^(.+?)(?:\s+(\d+)(?::(\d+))?)?$/i);
  if (!match) return null;

  const [, rawBook, rawChapter, rawVerse] = match;
  const normalizedBook = BOOK_ALIASES[normalizeBookToken(rawBook)] || normalizeBookToken(rawBook);
  const book = BIBLE_BOOKS.find((item) => {
    const normalizedName = normalizeBookToken(item.name);
    const normalizedId = normalizeBookToken(item.id);
    return normalizedBook === normalizedName || normalizedBook === normalizedId;
  });

  if (!book) return null;

  const chapter = rawChapter ? Number.parseInt(rawChapter, 10) : 1;
  const verse = rawVerse ? Number.parseInt(rawVerse, 10) : 1;

  if (Number.isNaN(chapter) || chapter < 1 || chapter > book.chapters) return null;
  if (Number.isNaN(verse) || verse < 1) return null;

  return {
    bookId: book.id,
    chapter,
    verse,
    hasExplicitVerse: Boolean(rawVerse),
  };
}
