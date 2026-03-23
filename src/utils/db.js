import { openDB } from 'idb';
import { chapterVersesEqual, normalizeChapterVerses } from './chapterData';

const DB_NAME = 'yeshua-bible';
const DB_VERSION = 2;

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
      },
    });
  }
  return dbPromise;
}

// --- Chapter storage ---

export async function saveChapter(translationId, bookId, chapter, verses) {
  const db = await getDB();
  const key = `${translationId}:${bookId}:${chapter}`;
  const normalizedVerses = normalizeChapterVerses(verses);
  await db.put('chapters', normalizedVerses, key);
  return normalizedVerses;
}

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

export async function saveTranslationMeta(translationId, meta) {
  const db = await getDB();
  await db.put('translations', meta, translationId);
}

export async function getTranslationMeta(translationId) {
  const db = await getDB();
  const meta = await db.get('translations', translationId);
  return meta ? { ...meta, isComplete: isTranslationComplete(meta) } : null;
}

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

export async function deleteTranslationMeta(translationId) {
  const db = await getDB();
  await db.delete('translations', translationId);
}

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

export async function saveLibraryChapter(collectionId, workId, chapter, verses) {
  const db = await getDB();
  const key = `${collectionId}:${workId}:${chapter}`;
  const normalizedVerses = normalizeChapterVerses(verses);
  await db.put('libraryChapters', normalizedVerses, key);
  return normalizedVerses;
}

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

export async function saveLibraryCollectionMeta(collectionId, meta) {
  const db = await getDB();
  await db.put('libraryCollections', meta, collectionId);
}

export async function getLibraryCollectionMeta(collectionId) {
  const db = await getDB();
  const meta = await db.get('libraryCollections', collectionId);
  return meta ? { ...meta, isComplete: isLibraryCollectionComplete(meta) } : null;
}

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

export async function deleteLibraryCollectionMeta(collectionId) {
  const db = await getDB();
  await db.delete('libraryCollections', collectionId);
}

// --- Notes ---

export async function saveNote(note) {
  const db = await getDB();
  if (note.id) {
    await db.put('notes', note);
    return note.id;
  }
  return db.add('notes', note);
}

export async function getNote(id) {
  const db = await getDB();
  return db.get('notes', id);
}

export async function getAllNotes() {
  const db = await getDB();
  return db.getAll('notes');
}

export async function getNotesForChapter(bookId, chapter) {
  const db = await getDB();
  const key = `${bookId}:${chapter}`;
  return db.getAllFromIndex('notes', 'bookChapter', key);
}

export async function getNotesForVerse(bookId, chapter, verse) {
  const db = await getDB();
  const key = `${bookId}:${chapter}:${verse}`;
  return db.getAllFromIndex('notes', 'verseKey', key);
}

export async function deleteNote(id) {
  const db = await getDB();
  await db.delete('notes', id);
}
