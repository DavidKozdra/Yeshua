/**
 * appData
 *
 * Backup/restore layer for the entire app. Combines the IndexedDB stores
 * (notes, bookmarks, highlights, reading progress, translation/library metas)
 * and localStorage settings into a single versioned snapshot, and applies such
 * snapshots back. Used by the import/export and "clear all data" features.
 */

import { clearAllAppDbData, exportAppDbData, importAppDbData } from './db';
import { clearAppStorageData, exportAppStorageData, importAppStorageData } from './storage';

const APP_DATA_VERSION = 2;

/**
 * Build a complete, versioned export snapshot of all app data.
 * Gathers localStorage and IndexedDB contents in parallel and tags the result
 * with app id, schema version, timestamp, and per-store counts.
 * @returns {Promise<object>} Serializable snapshot suitable for download/import.
 */
export async function exportAppDataSnapshot() {
  const [storage, db] = await Promise.all([exportAppStorageData(), exportAppDbData()]);

  return {
    app: 'yeshua',
    version: APP_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      notes: db.notes?.length || 0,
      bookmarks: db.bookmarks?.length || 0,
      highlights: db.highlights?.length || 0,
      readingProgress: db.readingProgress?.length || 0,
      translations: db.translationMetas?.length || 0,
      libraryCollections: db.libraryMetas?.length || 0,
    },
    storage,
    db,
  };
}

/**
 * Permanently wipe all app data from both localStorage and IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearAllAppData() {
  await clearAppStorageData();
  await clearAllAppDbData();
}

/**
 * Restore app data from a previously exported snapshot.
 * Validates the app id and supported version, then writes the storage and DB
 * portions. In 'replace' mode existing data is overwritten; in 'merge' mode the
 * snapshot is merged into existing data.
 * @param {object} snapshot Snapshot produced by exportAppDataSnapshot.
 * @param {{ mode?: 'replace'|'merge' }} [options] Import strategy; defaults to 'replace'.
 * @returns {Promise<void>}
 * @throws {Error} If the file is not a Yeshua export or the version is unsupported.
 */
export async function importAppDataSnapshot(snapshot = {}, options = {}) {
  if (snapshot?.app !== 'yeshua') {
    throw new Error('This file is not a Yeshua data export.');
  }

  if (![1, APP_DATA_VERSION].includes(snapshot?.version)) {
    throw new Error('This export version is not supported.');
  }

  const mode = options.mode === 'merge' ? 'merge' : 'replace';
  importAppStorageData(snapshot.storage || {}, { mode });
  await importAppDbData(snapshot.db || {}, { mode });
}
