/**
 * IndexedDB persistence layer for the app.
 *
 * Wraps the "yeshua-bible" IndexedDB database (via idb) and exposes async CRUD
 * helpers for every offline store: Bible chapters and translation metadata,
 * non-Bible library chapters and collection metadata, user notes, reading
 * progress, bookmarks, and highlights. Also handles schema upgrades, verse
 * normalization on read/write, and full-database export/import/clear used for
 * backup and restore.
 */
import { openDB } from 'idb';
import { chapterVersesEqual, normalizeChapterVerses } from './chapterData';

const DB_NAME = 'yeshua-bible';
const DB_VERSION = 3;

let dbPromise;

function isTranslationComplete(meta) {
  if (!meta) return false;
  if (typeof meta.isComplete === 'boolean') return meta.isComplete;
  if (
    typeof meta.completedChapters === 'number' &&
    typeof meta.totalChapters === 'number'
  ) {
    return meta.totalChapters > 0 && meta.completedChapters >= meta.totalChapters;
  }
  return (meta.errors ?? 0) === 0;
}

function isLibraryCollectionComplete(meta) {
  if (!meta) return false;
  if (typeof meta.isComplete === 'boolean') return meta.isComplete;
  if (
    typeof meta.completedChapters === 'number' &&
    typeof meta.totalChapters === 'number'
  ) {
    return meta.totalChapters > 0 && meta.completedChapters >= meta.totalChapters;
  }
  return false;
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store Bible chapters: key = "translationId:bookId:chapter"
        if (!db.objectStoreNames.contains('chapters')) {
          db.createObjectStore('chapters');
        }
        // Store downloaded translation metadata
        if (!db.objectStoreNames.contains('translations')) {
          db.createObjectStore('translations');
        }
        // Store user notes
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', {
            keyPath: 'id',
            autoIncrement: true,
          });
          notesStore.createIndex('verseKey', 'verseKey', { unique: false });
          notesStore.createIndex('bookChapter', 'bookChapter', { unique: false });
        }
        // Store non-Bible library chapters: key = "collectionId:workId:chapter"
        if (!db.objectStoreNames.contains('libraryChapters')) {
          db.createObjectStore('libraryChapters');
        }
        // Store downloaded library collection metadata
        if (!db.objectStoreNames.contains('libraryCollections')) {
          db.createObjectStore('libraryCollections');
        }
        if (!db.objectStoreNames.contains('readingProgress')) {
          const progressStore = db.createObjectStore('readingProgress', {
            keyPath: 'id',
          });
          progressStore.createIndex('sourceType', 'sourceType', { unique: false });
          progressStore.createIndex('completedAt', 'completedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarksStore = db.createObjectStore('bookmarks', {
            keyPath: 'id',
          });
          bookmarksStore.createIndex('targetKey', 'targetKey', { unique: false });
          bookmarksStore.createIndex('sourceType', 'sourceType', { unique: false });
          bookmarksStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('highlights')) {
          const highlightsStore = db.createObjectStore('highlights', {
            keyPath: 'id',
          });
          highlightsStore.createIndex('targetKey', 'targetKey', { unique: false });
          highlightsStore.createIndex('sourceType', 'sourceType', { unique: false });
          highlightsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// Write many key/value records into a keyPath-less store using a single
// transaction. Avoids awaiting each put, which makes large imports tractable.
async function bulkPut(storeName, entries) {
  if (!entries.length) return;
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const [key, value] of entries) {
    store.put(value, key);
  }
  await tx.done;
}

function makeId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  }
  return [];
}

function normalizeSourceType(value) {
  return value === 'library' ? 'library' : 'bible';
}

function buildTargetKey(target = {}) {
  const sourceType = normalizeSourceType(target.sourceType);
  if (sourceType === 'library') {
    return [
      'library',
      target.collectionId || '',
      target.workId || '',
      target.chapter || 1,
      target.verseStart || target.verse || '',
      target.verseEnd || target.verse || '',
    ].join(':');
  }

  return [
    'bible',
    target.translationId || '',
    target.bookId || '',
    target.chapter || 1,
    target.verseStart || target.verse || '',
    target.verseEnd || target.verse || '',
  ].join(':');
}

function normalizeNote(note = {}) {
  const now = new Date().toISOString();
  const sourceType = normalizeSourceType(note.sourceType);
  const verseStart = note.verseStart ?? note.verse ?? null;
  const verseEnd = note.verseEnd ?? note.verse ?? verseStart;
  const bookChapter = note.bookChapter || (note.bookId && note.chapter ? `${note.bookId}:${note.chapter}` : undefined);
  const verseKey =
    note.verseKey ||
    (note.bookId && note.chapter && verseStart ? `${note.bookId}:${note.chapter}:${verseStart}` : undefined);

  return {
    ...note,
    sourceType,
    tags: normalizeStringList(note.tags),
    verseStart,
    verseEnd,
    ...(bookChapter ? { bookChapter } : {}),
    ...(verseKey ? { verseKey } : {}),
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now,
  };
}

function buildReadingProgressKey(target = {}) {
  const sourceType = normalizeSourceType(target.sourceType);
  if (sourceType === 'library') {
    return ['library', target.collectionId || '', target.workId || '', target.chapter || 1].join(':');
  }

  // Reading progress is tracked per location, independent of translation, so a
  // chapter read in multiple translations counts once.
  return ['bible', target.bookId || '', target.chapter || 1].join(':');
}

function normalizeTargetRecord(record = {}, prefix) {
  const now = new Date().toISOString();
  const sourceType = normalizeSourceType(record.sourceType);
  const verseStart = record.verseStart ?? record.verse ?? null;
  const verseEnd = record.verseEnd ?? record.verse ?? verseStart;
  const normalized = {
    ...record,
    id: record.id || makeId(prefix),
    sourceType,
    verseStart,
    verseEnd,
    targetKey: record.targetKey || buildTargetKey({ ...record, sourceType, verseStart, verseEnd }),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  };
  delete normalized.verse;
  return normalized;
}

// --- Chapter storage ---

/**
 * Save a Bible chapter's verses for a translation.
 *
 * Verses are normalized before storage; key is "translationId:bookId:chapter".
 *
 * @param {string} translationId Translation identifier.
 * @param {string} bookId Book identifier.
 * @param {number} chapter Chapter number.
 * @param {Array} verses Raw verse entries to store.
 * @returns {Promise<Array<{verse: number, text: string}>>} The normalized verses written.
 */
export async function saveChapter(translationId, bookId, chapter, verses) {
  const db = await getDB();
  const key = `${translationId}:${bookId}:${chapter}`;
  const normalizedVerses = normalizeChapterVerses(verses);
  await db.put('chapters', normalizedVerses, key);
  return normalizedVerses;
}

/**
 * Read a stored Bible chapter, re-normalizing and rewriting if stale.
 *
 * @param {string} translationId Translation identifier.
 * @param {string} bookId Book identifier.
 * @param {number} chapter Chapter number.
 * @returns {Promise<Array<{verse: number, text: string}>|undefined>} Normalized
 *   verses, or undefined if the chapter is not stored.
 */
export async function getChapter(translationId, bookId, chapter) {
  const db = await getDB();
  const key = `${translationId}:${bookId}:${chapter}`;
  const storedVerses = await db.get('chapters', key);
  if (!storedVerses) return storedVerses;

  const normalizedVerses = normalizeChapterVerses(storedVerses);
  if (!chapterVersesEqual(storedVerses, normalizedVerses)) {
    await db.put('chapters', normalizedVerses, key);
  }

  return normalizedVerses;
}

/**
 * Delete all stored chapters belonging to a translation.
 *
 * @param {string} translationId Translation identifier.
 * @returns {Promise<void>}
 */
export async function deleteTranslationData(translationId) {
  const db = await getDB();
  const tx = db.transaction('chapters', 'readwrite');
  const store = tx.objectStore('chapters');
  const keys = await store.getAllKeys();
  for (const key of keys) {
    if (key.startsWith(translationId + ':')) {
      await store.delete(key);
    }
  }
  await tx.done;
}

// --- Translation metadata ---

/**
 * Persist metadata for a translation.
 *
 * @param {string} translationId Translation identifier.
 * @param {Object} meta Translation metadata to store.
 * @returns {Promise<void>}
 */
export async function saveTranslationMeta(translationId, meta) {
  const db = await getDB();
  await db.put('translations', meta, translationId);
}

/**
 * Read a translation's metadata with a derived isComplete flag.
 *
 * @param {string} translationId Translation identifier.
 * @returns {Promise<Object|null>} Metadata plus isComplete, or null if absent.
 */
export async function getTranslationMeta(translationId) {
  const db = await getDB();
  const meta = await db.get('translations', translationId);
  return meta ? { ...meta, isComplete: isTranslationComplete(meta) } : null;
}

/**
 * List downloaded translations with derived completion state.
 *
 * @param {Object} [options] Options.
 * @param {boolean} [options.includeIncomplete=false] Include partially downloaded translations.
 * @returns {Promise<Array<Object>>} Translation metadata records (each with id and isComplete).
 */
export async function getAllDownloadedTranslations(options = {}) {
  const { includeIncomplete = false } = options;
  const db = await getDB();
  const keys = await db.getAllKeys('translations');
  const results = [];
  for (const key of keys) {
    const meta = await db.get('translations', key);
    if (!meta) continue;
    const normalized = { id: key, ...meta, isComplete: isTranslationComplete(meta) };
    if (includeIncomplete || normalized.isComplete) {
      results.push(normalized);
    }
  }
  return results;
}

/**
 * Delete a translation's metadata record.
 *
 * @param {string} translationId Translation identifier.
 * @returns {Promise<void>}
 */
export async function deleteTranslationMeta(translationId) {
  const db = await getDB();
  await db.delete('translations', translationId);
}

/**
 * Collect every stored chapter for a translation.
 *
 * Cursors the chapters store, parsing keys for the given translation.
 *
 * @param {string} translationId Translation identifier.
 * @returns {Promise<Array<{bookId: string, chapter: number, verses: Array}>>}
 *   One entry per stored chapter.
 */
export async function getTranslationChapterEntries(translationId) {
  const db = await getDB();
  const tx = db.transaction('chapters');
  const store = tx.objectStore('chapters');
  const entries = [];
  let cursor = await store.openCursor();

  while (cursor) {
    if (typeof cursor.key === 'string' && cursor.key.startsWith(`${translationId}:`)) {
      const [, bookId, rawChapter] = cursor.key.split(':');
      const chapter = Number.parseInt(rawChapter, 10);
      if (bookId && !Number.isNaN(chapter)) {
        entries.push({
          bookId,
          chapter,
          verses: normalizeChapterVerses(cursor.value),
        });
      }
    }

    cursor = await cursor.continue();
  }

  await tx.done;
  return entries;
}

// --- Library chapter storage ---

/**
 * Save a library work's chapter verses.
 *
 * Verses are normalized; key is "collectionId:workId:chapter".
 *
 * @param {string} collectionId Library collection identifier.
 * @param {string} workId Work identifier within the collection.
 * @param {number} chapter Chapter number.
 * @param {Array} verses Raw verse entries to store.
 * @returns {Promise<Array<{verse: number, text: string}>>} The normalized verses written.
 */
export async function saveLibraryChapter(collectionId, workId, chapter, verses) {
  const db = await getDB();
  const key = `${collectionId}:${workId}:${chapter}`;
  const normalizedVerses = normalizeChapterVerses(verses);
  await db.put('libraryChapters', normalizedVerses, key);
  return normalizedVerses;
}

/**
 * Read a stored library chapter, re-normalizing and rewriting if stale.
 *
 * @param {string} collectionId Library collection identifier.
 * @param {string} workId Work identifier.
 * @param {number} chapter Chapter number.
 * @returns {Promise<Array<{verse: number, text: string}>|undefined>} Normalized
 *   verses, or undefined if not stored.
 */
export async function getLibraryChapter(collectionId, workId, chapter) {
  const db = await getDB();
  const key = `${collectionId}:${workId}:${chapter}`;
  const storedVerses = await db.get('libraryChapters', key);
  if (!storedVerses) return storedVerses;

  const normalizedVerses = normalizeChapterVerses(storedVerses);
  if (!chapterVersesEqual(storedVerses, normalizedVerses)) {
    await db.put('libraryChapters', normalizedVerses, key);
  }

  return normalizedVerses;
}

/**
 * Delete all stored chapters belonging to a library collection.
 *
 * @param {string} collectionId Library collection identifier.
 * @returns {Promise<void>}
 */
export async function deleteLibraryCollectionData(collectionId) {
  const db = await getDB();
  const tx = db.transaction('libraryChapters', 'readwrite');
  const store = tx.objectStore('libraryChapters');
  const keys = await store.getAllKeys();

  for (const key of keys) {
    if (typeof key === 'string' && key.startsWith(`${collectionId}:`)) {
      await store.delete(key);
    }
  }

  await tx.done;
}

// --- Library collection metadata ---

/**
 * Persist metadata for a library collection.
 *
 * @param {string} collectionId Library collection identifier.
 * @param {Object} meta Collection metadata to store.
 * @returns {Promise<void>}
 */
export async function saveLibraryCollectionMeta(collectionId, meta) {
  const db = await getDB();
  await db.put('libraryCollections', meta, collectionId);
}

/**
 * Read a library collection's metadata with a derived isComplete flag.
 *
 * @param {string} collectionId Library collection identifier.
 * @returns {Promise<Object|null>} Metadata plus isComplete, or null if absent.
 */
export async function getLibraryCollectionMeta(collectionId) {
  const db = await getDB();
  const meta = await db.get('libraryCollections', collectionId);
  return meta ? { ...meta, isComplete: isLibraryCollectionComplete(meta) } : null;
}

/**
 * List downloaded library collections with derived completion state.
 *
 * @param {Object} [options] Options.
 * @param {boolean} [options.includeIncomplete=false] Include partially downloaded collections.
 * @returns {Promise<Array<Object>>} Collection metadata records (each with id and isComplete).
 */
export async function getAllDownloadedLibraryCollections(options = {}) {
  const { includeIncomplete = false } = options;
  const db = await getDB();
  const keys = await db.getAllKeys('libraryCollections');
  const results = [];

  for (const key of keys) {
    const meta = await db.get('libraryCollections', key);
    if (!meta) continue;

    const normalized = {
      id: key,
      ...meta,
      isComplete: isLibraryCollectionComplete(meta),
    };

    if (includeIncomplete || normalized.isComplete) {
      results.push(normalized);
    }
  }

  return results;
}

/**
 * Delete a library collection's metadata record.
 *
 * @param {string} collectionId Library collection identifier.
 * @returns {Promise<void>}
 */
export async function deleteLibraryCollectionMeta(collectionId) {
  const db = await getDB();
  await db.delete('libraryCollections', collectionId);
}

// --- Notes ---

/**
 * Create or update a user note.
 *
 * Normalizes the note (source type, tags, verse keys, timestamps); updates in
 * place when an id is present, otherwise inserts a new record.
 *
 * @param {Object} note The note to save.
 * @returns {Promise<number|string>} The note's id.
 */
export async function saveNote(note) {
  const db = await getDB();
  const normalizedNote = normalizeNote(note);
  if (normalizedNote.id) {
    await db.put('notes', normalizedNote);
    return normalizedNote.id;
  }
  return db.add('notes', normalizedNote);
}

/**
 * Fetch a single note by id.
 *
 * @param {number|string} id Note id.
 * @returns {Promise<Object|undefined>} The note, or undefined if not found.
 */
export async function getNote(id) {
  const db = await getDB();
  return db.get('notes', id);
}

/**
 * Fetch all stored notes.
 *
 * @returns {Promise<Array<Object>>} Every note record.
 */
export async function getAllNotes() {
  const db = await getDB();
  return db.getAll('notes');
}

/**
 * Fetch notes attached to a specific book chapter.
 *
 * @param {string} bookId Book identifier.
 * @param {number} chapter Chapter number.
 * @returns {Promise<Array<Object>>} Matching notes.
 */
export async function getNotesForChapter(bookId, chapter) {
  const db = await getDB();
  const key = `${bookId}:${chapter}`;
  return db.getAllFromIndex('notes', 'bookChapter', key);
}

/**
 * Fetch notes attached to a specific verse.
 *
 * @param {string} bookId Book identifier.
 * @param {number} chapter Chapter number.
 * @param {number} verse Verse number.
 * @returns {Promise<Array<Object>>} Matching notes.
 */
export async function getNotesForVerse(bookId, chapter, verse) {
  const db = await getDB();
  const key = `${bookId}:${chapter}:${verse}`;
  return db.getAllFromIndex('notes', 'verseKey', key);
}

/**
 * Delete a note by id.
 *
 * @param {number|string} id Note id.
 * @returns {Promise<void>}
 */
export async function deleteNote(id) {
  const db = await getDB();
  await db.delete('notes', id);
}

// --- Reading progress, bookmarks, and highlights ---

/**
 * Record reading progress for a location.
 *
 * Builds a translation-independent location key so a chapter read in multiple
 * translations counts once, and stamps completedAt when absent.
 *
 * @param {Object} progress Progress descriptor (location/source fields).
 * @returns {Promise<string>} The progress record id.
 */
export async function saveReadingProgress(progress) {
  const db = await getDB();
  const locationKey = buildReadingProgressKey(progress);
  const normalized = normalizeTargetRecord(
    {
      ...progress,
      id: progress.id || locationKey,
      locationKey,
      completedAt: progress.completedAt || new Date().toISOString(),
    },
    'progress'
  );
  await db.put('readingProgress', normalized);
  return normalized.id;
}

/**
 * Fetch all reading progress records.
 *
 * @returns {Promise<Array<Object>>} Every reading progress entry.
 */
export async function getAllReadingProgress() {
  const db = await getDB();
  return db.getAll('readingProgress');
}

/**
 * Summarize reading progress across all records.
 *
 * @returns {Promise<{completedChapters: number, activeDays: number, recent: Array<Object>}>}
 *   Count of distinct completed locations, distinct active days, and the 8 most
 *   recent entries.
 */
export async function getReadingProgressSummary() {
  const entries = await getAllReadingProgress();
  const completedChapters = new Set(
    entries.map((entry) => entry.locationKey || buildReadingProgressKey(entry))
  ).size;
  const recent = [...entries]
    .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
    .slice(0, 8);
  const activeDays = new Set(
    entries
      .map((entry) => (entry.completedAt || entry.updatedAt || '').slice(0, 10))
      .filter(Boolean)
  ).size;

  return {
    completedChapters,
    activeDays,
    recent,
  };
}

/**
 * Get the most recently read locations.
 *
 * @param {number} [limit=8] Maximum number of entries to return.
 * @returns {Promise<Array<Object>>} Recent reading progress entries.
 */
export async function getRecentReading(limit = 8) {
  const summary = await getReadingProgressSummary();
  return summary.recent.slice(0, limit);
}

/**
 * Create or update a bookmark.
 *
 * Normalizes the record and deduplicates by targetKey + sourceType, updating
 * the existing bookmark in place when a match is found.
 *
 * @param {Object} bookmark The bookmark to save.
 * @returns {Promise<string>} The bookmark id.
 */
export async function saveBookmark(bookmark) {
  const db = await getDB();
  const normalized = normalizeTargetRecord(bookmark, 'bookmark');
  const existingBookmarks = await db.getAll('bookmarks');
  const existingBookmark = existingBookmarks.find(
    (entry) => entry.targetKey === normalized.targetKey && entry.sourceType === normalized.sourceType
  );
  if (existingBookmark) {
    const updatedBookmark = {
      ...existingBookmark,
      ...normalized,
      id: existingBookmark.id,
      createdAt: existingBookmark.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await db.put('bookmarks', updatedBookmark);
    return updatedBookmark.id;
  }
  await db.put('bookmarks', normalized);
  return normalized.id;
}

/**
 * Delete a bookmark by id.
 *
 * @param {string} id Bookmark id.
 * @returns {Promise<void>}
 */
export async function deleteBookmark(id) {
  const db = await getDB();
  await db.delete('bookmarks', id);
}

/**
 * Fetch bookmarks, optionally filtered, sorted newest first.
 *
 * @param {Object} [filter] Optional filters (sourceType, targetKey, bookId, collectionId).
 * @returns {Promise<Array<Object>>} Matching bookmarks ordered by createdAt descending.
 */
export async function getBookmarks(filter = {}) {
  const db = await getDB();
  const bookmarks = await db.getAll('bookmarks');
  return bookmarks
    .filter((bookmark) => {
      if (filter.sourceType && bookmark.sourceType !== filter.sourceType) return false;
      if (filter.targetKey && bookmark.targetKey !== filter.targetKey) return false;
      if (filter.bookId && bookmark.bookId !== filter.bookId) return false;
      if (filter.collectionId && bookmark.collectionId !== filter.collectionId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Save a highlight (defaulting color to gold).
 *
 * @param {Object} highlight The highlight to save.
 * @returns {Promise<string>} The highlight id.
 */
export async function saveHighlight(highlight) {
  const db = await getDB();
  const normalized = normalizeTargetRecord(
    {
      color: 'gold',
      ...highlight,
    },
    'highlight'
  );
  await db.put('highlights', normalized);
  return normalized.id;
}

/**
 * Delete a highlight by id.
 *
 * @param {string} id Highlight id.
 * @returns {Promise<void>}
 */
export async function deleteHighlight(id) {
  const db = await getDB();
  await db.delete('highlights', id);
}

/**
 * Delete all highlights matching a target verse/range.
 *
 * Normalizes verse bounds on both stored and target sides so a single-verse
 * target matches regardless of how it was saved, and matches on the
 * appropriate library or Bible identifiers.
 *
 * @param {Object} [target] Target descriptor (sourceType, chapter, verse range,
 *   plus collection/work or translation/book ids).
 * @returns {Promise<number>} Number of highlights deleted.
 */
export async function deleteHighlightsForTarget(target = {}) {
  const db = await getDB();
  const highlights = await db.getAll('highlights');
  const sourceType = normalizeSourceType(target.sourceType);
  const verseStart = target.verseStart ?? target.verse ?? null;
  const verseEnd = target.verseEnd ?? target.verse ?? verseStart;
  const matchingHighlights = highlights.filter((highlight) => {
    if (highlight.sourceType !== sourceType) return false;
    if (Number(highlight.chapter) !== Number(target.chapter)) return false;
    // Highlights may be stored with only `verse`/`verseStart`; normalize both
    // sides so a single-verse target matches regardless of how it was saved.
    const highlightStart = highlight.verseStart ?? highlight.verse ?? null;
    const highlightEnd = highlight.verseEnd ?? highlight.verse ?? highlightStart;
    if (Number(highlightStart) !== Number(verseStart)) return false;
    if (Number(highlightEnd) !== Number(verseEnd)) return false;

    if (sourceType === 'library') {
      return (
        highlight.collectionId === target.collectionId &&
        highlight.workId === target.workId
      );
    }

    return (
      highlight.translationId === target.translationId &&
      highlight.bookId === target.bookId
    );
  });

  await Promise.all(matchingHighlights.map((highlight) => db.delete('highlights', highlight.id)));
  return matchingHighlights.length;
}

/**
 * Fetch all highlights for a given chapter.
 *
 * @param {Object} [target] Chapter descriptor (sourceType, chapter, plus
 *   collection/work or translation/book ids).
 * @returns {Promise<Array<Object>>} Matching highlights.
 */
export async function getHighlightsForChapter(target = {}) {
  const db = await getDB();
  const highlights = await db.getAll('highlights');
  const sourceType = normalizeSourceType(target.sourceType);
  return highlights.filter((highlight) => {
    if (highlight.sourceType !== sourceType) return false;
    if (sourceType === 'library') {
      return (
        highlight.collectionId === target.collectionId &&
        highlight.workId === target.workId &&
        Number(highlight.chapter) === Number(target.chapter)
      );
    }
    return (
      highlight.translationId === target.translationId &&
      highlight.bookId === target.bookId &&
      Number(highlight.chapter) === Number(target.chapter)
    );
  });
}

/**
 * Collect every stored library chapter across all collections.
 *
 * @returns {Promise<Array<{collectionId: string, workId: string, chapter: number, verses: Array}>>}
 *   One entry per stored library chapter.
 */
export async function getAllLibraryChapterEntries() {
  const db = await getDB();
  const tx = db.transaction('libraryChapters');
  const store = tx.objectStore('libraryChapters');
  const entries = [];
  let cursor = await store.openCursor();

  while (cursor) {
    if (typeof cursor.key === 'string') {
      const [collectionId, workId, rawChapter] = cursor.key.split(':');
      const chapter = Number.parseInt(rawChapter, 10);
      if (collectionId && workId && !Number.isNaN(chapter)) {
        entries.push({
          collectionId,
          workId,
          chapter,
          verses: normalizeChapterVerses(cursor.value),
        });
      }
    }

    cursor = await cursor.continue();
  }

  await tx.done;
  return entries;
}

/**
 * Collect raw metadata entries for all library collections.
 *
 * @returns {Promise<Array<{id: string, meta: Object}>>} Collection id/meta pairs.
 */
export async function getAllLibraryCollectionMetaEntries() {
  const db = await getDB();
  const keys = await db.getAllKeys('libraryCollections');
  const results = [];

  for (const key of keys) {
    const meta = await db.get('libraryCollections', key);
    if (meta) {
      results.push({ id: key, meta });
    }
  }

  return results;
}

/**
 * Collect raw metadata entries for all translations.
 *
 * @returns {Promise<Array<{id: string, meta: Object}>>} Translation id/meta pairs.
 */
export async function getAllTranslationMetaEntries() {
  const db = await getDB();
  const keys = await db.getAllKeys('translations');
  const results = [];

  for (const key of keys) {
    const meta = await db.get('translations', key);
    if (meta) {
      results.push({ id: key, meta });
    }
  }

  return results;
}

/**
 * Clear every object store in the app database.
 *
 * Wipes chapters, translations, notes, library chapters/collections, reading
 * progress, bookmarks, and highlights.
 *
 * @returns {Promise<void>}
 */
export async function clearAllAppDbData() {
  const db = await getDB();

  await Promise.all([
    db.clear('chapters'),
    db.clear('translations'),
    db.clear('notes'),
    db.clear('libraryChapters'),
    db.clear('libraryCollections'),
    db.clear('readingProgress'),
    db.clear('bookmarks'),
    db.clear('highlights'),
  ]);
}

/**
 * Export the full app database as a serializable snapshot.
 *
 * Gathers translation metadata and chapters, library metadata and chapters,
 * notes, reading progress, bookmarks, and highlights for backup.
 *
 * @returns {Promise<Object>} Snapshot with translationMetas, translationChapters,
 *   libraryMetas, libraryChapters, notes, readingProgress, bookmarks, and highlights.
 */
export async function exportAppDbData() {
  const [
    translationMetas,
    translationChapters,
    libraryMetas,
    libraryChapters,
    notes,
    readingProgress,
    bookmarks,
    highlights,
  ] =
    await Promise.all([
      getAllTranslationMetaEntries(),
      (async () => {
        const metaEntries = await getAllTranslationMetaEntries();
        const chapterGroups = await Promise.all(
          metaEntries.map(async ({ id }) => ({
            id,
            chapters: await getTranslationChapterEntries(id),
          }))
        );
        return chapterGroups.filter((entry) => entry.chapters.length > 0);
      })(),
      getAllLibraryCollectionMetaEntries(),
      getAllLibraryChapterEntries(),
      getAllNotes(),
      getAllReadingProgress(),
      getBookmarks(),
      (async () => {
        const db = await getDB();
        return db.getAll('highlights');
      })(),
    ]);

  return {
    translationMetas,
    translationChapters,
    libraryMetas,
    libraryChapters,
    notes,
    readingProgress,
    bookmarks,
    highlights,
  };
}

/**
 * Import a previously exported snapshot into the app database.
 *
 * In the default 'replace' mode the database is cleared first; in 'merge' mode
 * existing data is preserved and the snapshot is layered on top. Chapters are
 * written in bulk and verses re-normalized.
 *
 * @param {Object} [snapshot] Snapshot produced by exportAppDbData.
 * @param {Object} [options] Options.
 * @param {'replace'|'merge'} [options.mode='replace'] Import strategy.
 * @returns {Promise<void>}
 */
export async function importAppDbData(snapshot = {}, options = {}) {
  const { mode = 'replace' } = options;
  if (mode !== 'merge') {
    await clearAllAppDbData();
  }

  for (const entry of snapshot.translationMetas || []) {
    if (entry?.id && entry?.meta) {
      await saveTranslationMeta(entry.id, entry.meta);
    }
  }

  const chapterEntries = [];
  for (const group of snapshot.translationChapters || []) {
    if (!group?.id || !Array.isArray(group.chapters)) continue;
    for (const chapterEntry of group.chapters) {
      if (chapterEntry?.bookId && Number.isInteger(chapterEntry?.chapter)) {
        chapterEntries.push([
          `${group.id}:${chapterEntry.bookId}:${chapterEntry.chapter}`,
          normalizeChapterVerses(chapterEntry.verses || []),
        ]);
      }
    }
  }
  await bulkPut('chapters', chapterEntries);

  for (const entry of snapshot.libraryMetas || []) {
    if (entry?.id && entry?.meta) {
      await saveLibraryCollectionMeta(entry.id, entry.meta);
    }
  }

  const libraryChapterEntries = [];
  for (const entry of snapshot.libraryChapters || []) {
    if (entry?.collectionId && entry?.workId && Number.isInteger(entry?.chapter)) {
      libraryChapterEntries.push([
        `${entry.collectionId}:${entry.workId}:${entry.chapter}`,
        normalizeChapterVerses(entry.verses || []),
      ]);
    }
  }
  await bulkPut('libraryChapters', libraryChapterEntries);

  for (const note of snapshot.notes || []) {
    if (note && typeof note === 'object') {
      await saveNote(note);
    }
  }

  for (const progress of snapshot.readingProgress || []) {
    if (progress && typeof progress === 'object') {
      await saveReadingProgress(progress);
    }
  }

  for (const bookmark of snapshot.bookmarks || []) {
    if (bookmark && typeof bookmark === 'object') {
      await saveBookmark(bookmark);
    }
  }

  for (const highlight of snapshot.highlights || []) {
    if (highlight && typeof highlight === 'object') {
      await saveHighlight(highlight);
    }
  }
}
