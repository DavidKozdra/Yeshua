import { clearAllAppDbData, exportAppDbData, importAppDbData } from './db';
import { clearAppStorageData, exportAppStorageData, importAppStorageData } from './storage';

const APP_DATA_VERSION = 1;

export async function exportAppDataSnapshot() {
  const [storage, db] = await Promise.all([exportAppStorageData(), exportAppDbData()]);

  return {
    app: 'yeshua',
    version: APP_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    storage,
    db,
  };
}

export async function clearAllAppData() {
  await clearAppStorageData();
  await clearAllAppDbData();
}

export async function importAppDataSnapshot(snapshot = {}) {
  if (snapshot?.app !== 'yeshua') {
    throw new Error('This file is not a Yeshua data export.');
  }

  if (snapshot?.version !== APP_DATA_VERSION) {
    throw new Error('This export version is not supported.');
  }

  importAppStorageData(snapshot.storage || {});
  await importAppDbData(snapshot.db || {});
}
