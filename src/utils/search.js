import { BIBLE_BOOKS, getBookById } from './bibleData';
import {
  getAllLibraryChapterEntries,
  getAllNotes,
  getTranslationChapterEntries,
} from './db';
import { getBooksCollectionById, getBooksWorkById } from './booksData';

const bundleLoaders = import.meta.glob('../data/*-bundle.json');
const bundleCache = new Map();
const BOOK_ORDER = new Map(BIBLE_BOOKS.map((book, index) => [book.id, index]));

function getBundleLoaderKey(translationId) {
  return `../data/${translationId}-bundle.json`;
}

export async function loadTranslationBundle(translationId) {
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
  { maxResults = 250, signal } = {}
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
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
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

function normalizeSearchQuery(query) {
  return String(query || '').trim();
}

function textMatches(text, query, options = {}) {
  const normalizedText = String(text || '');
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return false;

  const flags = options.caseSensitive ? 'g' : 'gi';
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;

  if (options.exactPhrase || options.wholeWord) {
    return new RegExp(pattern, flags).test(normalizedText);
  }

  return normalizedText.toLowerCase().includes(normalizedQuery.toLowerCase());
}

export function isBookAllowed(bookId, filters = {}) {
  if (Array.isArray(filters.books) && filters.books.length && !filters.books.includes(bookId)) {
    return false;
  }

  if (filters.testament) {
    const book = getBookById(bookId);
    if (book?.testament !== filters.testament) return false;
  }

  return true;
}

async function searchBibleContent({
  query,
  translationId,
  maxResults,
  signal,
  books,
  testament,
  exactPhrase,
  wholeWord,
}) {
  const chapterEntries = await getTranslationChapterEntriesForSearch(translationId);
  const results = [];
  let totalMatches = 0;

  for (const entry of chapterEntries) {
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
    if (!isBookAllowed(entry.bookId, { books, testament })) continue;

    for (const verse of entry.verses) {
      if (!textMatches(verse?.text, query, { exactPhrase, wholeWord })) continue;
      totalMatches += 1;
      if (results.length < maxResults) {
        results.push({
          sourceType: 'bible',
          type: 'Scripture',
          bookId: entry.bookId,
          bookName: getBookById(entry.bookId)?.name || entry.bookId,
          chapter: entry.chapter,
          verse: verse.verse,
          text: verse.text,
        });
      }
    }
  }

  return { results, totalMatches };
}

async function searchLibraryContent({ query, maxResults, signal, exactPhrase, wholeWord }) {
  const chapterEntries = await getAllLibraryChapterEntries();
  const results = [];
  let totalMatches = 0;

  for (const entry of chapterEntries) {
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
    const collection = getBooksCollectionById(entry.collectionId);
    const work = getBooksWorkById(entry.collectionId, entry.workId);

    for (const verse of entry.verses) {
      if (!textMatches(verse?.text, query, { exactPhrase, wholeWord })) continue;
      totalMatches += 1;
      if (results.length < maxResults) {
        results.push({
          sourceType: 'library',
          type: collection?.name || 'Library',
          collectionId: entry.collectionId,
          workId: entry.workId,
          workTitle: work?.title || entry.workId,
          chapter: entry.chapter,
          verse: verse.verse,
          text: verse.text,
        });
      }
    }
  }

  return { results, totalMatches };
}

async function searchNotesContent({ query, maxResults, signal, exactPhrase, wholeWord }) {
  const notes = await getAllNotes();
  const results = [];
  let totalMatches = 0;

  for (const note of notes) {
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
    const searchable = [note.title, note.text, ...(note.tags || [])].filter(Boolean).join(' ');
    if (!textMatches(searchable, query, { exactPhrase, wholeWord })) continue;
    totalMatches += 1;
    if (results.length < maxResults) {
      results.push({
        sourceType: 'note',
        type: 'Note',
        noteId: note.id,
        title: note.title || 'Untitled note',
        bookId: note.bookId,
        collectionId: note.collectionId,
        workId: note.workId,
        chapter: note.chapter,
        verse: note.verseStart || note.verse,
        tags: note.tags || [],
        text: note.text || '',
      });
    }
  }

  return { results, totalMatches };
}

export async function searchContent({
  query,
  translationId,
  sourceTypes = ['bible'],
  books = [],
  testament = '',
  exactPhrase = false,
  wholeWord = false,
  includeNotes = false,
  maxResults = 250,
  signal,
} = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return {
      query: '',
      results: [],
      totalMatches: 0,
      truncated: false,
    };
  }

  const requestedSources = new Set(sourceTypes);
  if (includeNotes) requestedSources.add('note');

  // Run each requested source, capping its own results at maxResults so no
  // single source can starve the others when results are later combined.
  const sourceResults = [];
  let totalMatches = 0;

  async function runSearch(searchPromise) {
    const result = await searchPromise;
    totalMatches += result.totalMatches;
    sourceResults.push(result.results);
  }

  if (requestedSources.has('bible') && translationId) {
    await runSearch(
      searchBibleContent({
        query: normalizedQuery,
        translationId,
        maxResults,
        signal,
        books,
        testament,
        exactPhrase,
        wholeWord,
      })
    );
  }

  if (requestedSources.has('library')) {
    await runSearch(
      searchLibraryContent({
        query: normalizedQuery,
        maxResults,
        signal,
        exactPhrase,
        wholeWord,
      })
    );
  }

  if (requestedSources.has('note')) {
    await runSearch(
      searchNotesContent({
        query: normalizedQuery,
        maxResults,
        signal,
        exactPhrase,
        wholeWord,
      })
    );
  }

  // Interleave across sources so every source that found matches is represented
  // in the (possibly truncated) result set, rather than the first source filling
  // every slot.
  const results = [];
  const cursors = sourceResults.map(() => 0);
  let remaining = true;
  while (results.length < maxResults && remaining) {
    remaining = false;
    for (let index = 0; index < sourceResults.length; index += 1) {
      if (results.length >= maxResults) break;
      const bucket = sourceResults[index];
      const cursor = cursors[index];
      if (cursor < bucket.length) {
        results.push(bucket[cursor]);
        cursors[index] += 1;
        remaining = true;
      }
    }
  }

  return {
    query: normalizedQuery,
    results,
    totalMatches,
    truncated: totalMatches > results.length,
  };
}
