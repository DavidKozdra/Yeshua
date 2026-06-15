import { BIBLE_BOOKS } from './bibleData';

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
