import { clearAllAppDbData, exportAppDbData, importAppDbData } from './db';
import { clearAppStorageData, exportAppStorageData, importAppStorageData } from './storage';

const APP_DATA_VERSION = 2;

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

export async function clearAllAppData() {
  await clearAppStorageData();
  await clearAllAppDbData();
}

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
