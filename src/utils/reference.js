/**
 * Scripture reference parsing.
 *
 * Converts free-form user input like "John 3:16", "gen 1", or "psalms" into a
 * structured reference (book id, chapter, verse). Handles common book aliases and
 * spelling variants, validates the chapter against the book's range, and reports
 * whether the chapter/verse were explicitly supplied.
 */

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

/**
 * Parses a free-form Scripture reference string into a structured target.
 * @param {string} input The reference text, e.g. "John 3:16", "gen 1", "psalms".
 * @returns {{bookId: string, chapter: number, verse: number,
 *   hasExplicitChapter: boolean, hasExplicitVerse: boolean}|null} The resolved
 *   reference, or null if the book is unknown or the chapter/verse is invalid.
 *   Chapter and verse default to 1 when omitted.
 */
export function parseReferenceInput(input) {
  if (typeof input !== 'string') return null;

  const match = input.trim().match(/^(.+?)(?:\s+(\d+)(?::(\d+))?)?$/i);
  if (!match) return null;

  const [, rawBook, rawChapter, rawVerse] = match;
  const tokenized = normalizeBookToken(rawBook);
  const aliasedId = BOOK_ALIASES[tokenized];
  const book = aliasedId
    ? BIBLE_BOOKS.find((item) => item.id === aliasedId)
    : BIBLE_BOOKS.find((item) => {
        const normalizedName = normalizeBookToken(item.name);
        const normalizedId = normalizeBookToken(item.id);
        return tokenized === normalizedName || tokenized === normalizedId;
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
    hasExplicitChapter: Boolean(rawChapter),
    hasExplicitVerse: Boolean(rawVerse),
  };
}
