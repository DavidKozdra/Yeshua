/**
 * bibleNavigation
 *
 * Pure helpers for moving between chapters of the Bible. Given a book/chapter
 * position they compute the adjacent chapter, rolling over book boundaries
 * using the canonical order in BIBLE_BOOKS. Used by the reader's prev/next
 * navigation controls.
 */

import { BIBLE_BOOKS } from './bibleData';

/**
 * Resolve the chapter that follows the given position.
 * Advances within the current book, or rolls over to chapter 1 of the next book.
 * @param {string} bookId Canonical book id (e.g. 'GEN').
 * @param {number} chapter Current 1-based chapter number.
 * @returns {{ bookId: string, chapter: number } | null} Next position, or null at the end of Revelation / unknown book.
 */
export function getNextBibleChapter(bookId, chapter) {
  const bookIndex = BIBLE_BOOKS.findIndex((book) => book.id === bookId);
  if (bookIndex < 0) return null;

  const book = BIBLE_BOOKS[bookIndex];
  if (chapter < book.chapters) {
    return { bookId, chapter: chapter + 1 };
  }

  const nextBook = BIBLE_BOOKS[bookIndex + 1];
  return nextBook ? { bookId: nextBook.id, chapter: 1 } : null;
}

/**
 * Resolve the chapter that precedes the given position.
 * Steps back within the current book, or rolls over to the last chapter of the previous book.
 * @param {string} bookId Canonical book id (e.g. 'EXO').
 * @param {number} chapter Current 1-based chapter number.
 * @returns {{ bookId: string, chapter: number } | null} Previous position, or null at the start of Genesis / unknown book.
 */
export function getPreviousBibleChapter(bookId, chapter) {
  const bookIndex = BIBLE_BOOKS.findIndex((book) => book.id === bookId);
  if (bookIndex < 0) return null;

  if (chapter > 1) {
    return { bookId, chapter: chapter - 1 };
  }

  const previousBook = BIBLE_BOOKS[bookIndex - 1];
  return previousBook
    ? { bookId: previousBook.id, chapter: previousBook.chapters }
    : null;
}
