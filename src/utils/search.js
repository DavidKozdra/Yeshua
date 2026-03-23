import { BIBLE_BOOKS, getBookById } from './bibleData';
import { getTranslationChapterEntries } from './db';

const bundleLoaders = import.meta.glob('../data/*-bundle.json');
const bundleCache = new Map();
const BOOK_ORDER = new Map(BIBLE_BOOKS.map((book, index) => [book.id, index]));

function getBundleLoaderKey(translationId) {
  return `../data/${translationId}-bundle.json`;
}

async function loadTranslationBundle(translationId) {
  const loaderKey = getBundleLoaderKey(translationId);
  const loader = bundleLoaders[loaderKey];
  if (!loader) return null;

  if (!bundleCache.has(loaderKey)) {
    bundleCache.set(
      loaderKey,
      loader().then((mod) => mod.default ?? mod)
    );
  }

  return bundleCache.get(loaderKey);
}

function sortChapterEntries(entries) {
  return [...entries].sort(
    (a, b) =>
      (BOOK_ORDER.get(a.bookId) ?? Number.MAX_SAFE_INTEGER) -
        (BOOK_ORDER.get(b.bookId) ?? Number.MAX_SAFE_INTEGER) ||
      a.chapter - b.chapter
  );
}

async function getTranslationChapterEntriesForSearch(translationId) {
  const bundle = await loadTranslationBundle(translationId);
  if (bundle) {
    return sortChapterEntries(
      Object.entries(bundle).map(([key, verses]) => {
        const [bookId, rawChapter] = key.split(':');
        return {
          bookId,
          chapter: Number.parseInt(rawChapter, 10),
          verses: Array.isArray(verses) ? verses : [],
        };
      })
    );
  }

  return sortChapterEntries(await getTranslationChapterEntries(translationId));
}

export async function searchTranslationText(
  translationId,
  query,
  { maxResults = 250 } = {}
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return {
      query: '',
      results: [],
      totalMatches: 0,
      truncated: false,
    };
  }

  const chapterEntries = await getTranslationChapterEntriesForSearch(translationId);
  const results = [];
  let totalMatches = 0;

  for (const entry of chapterEntries) {
    for (const verse of entry.verses) {
      if (!verse?.text?.toLowerCase().includes(normalizedQuery)) continue;

      totalMatches += 1;
      if (results.length < maxResults) {
        results.push({
          bookId: entry.bookId,
          bookName: getBookById(entry.bookId)?.name || entry.bookId,
          chapter: entry.chapter,
          verse: verse.verse,
          text: verse.text,
        });
      }
    }
  }

  return {
    query: query.trim(),
    results,
    totalMatches,
    truncated: totalMatches > maxResults,
  };
}
