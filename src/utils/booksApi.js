import {
  deleteLibraryCollectionData,
  deleteLibraryCollectionMeta,
  getLibraryChapter,
  getLibraryCollectionMeta,
  saveLibraryChapter,
  saveLibraryCollectionMeta,
} from './db';
import {
  getBooksCollectionById,
  getBooksCollectionStats,
  getBooksCollectionWorks,
  getBooksWorkById,
} from './booksData';

const DOWNLOAD_PROGRESS_SAVE_EVERY = 8;
const collectionWorksCache = new Map();
const activeDownloads = new Map();
const installEventTarget = new EventTarget();
const queuedInstalls = [];
const queuedInstallRecords = new Map();
let activeInstallId = null;
let queueProcessorPromise = null;

function hasChapterContent(chapterData) {
  return Array.isArray(chapterData) && chapterData.length > 0;
}

function normalizeVerses(items, options = {}) {
  const { verseKey = 'verse', textKey = 'text' } = options;
  const seenVerses = new Set();
  const normalized = [];

  for (const item of items || []) {
    const verse = Number(item?.[verseKey]);
    const text = typeof item?.[textKey] === 'string' ? item[textKey].trim() : '';

    if (!Number.isInteger(verse) || verse < 1 || !text || seenVerses.has(verse)) {
      continue;
    }

    seenVerses.add(verse);
    normalized.push({ verse, text });
  }

  return normalized;
}

function createCollectionMeta(collection, works, currentMeta = {}, overrides = {}) {
  const stats = getBooksCollectionStats(collection.id, works);

  return {
    name: collection.name,
    tradition: collection.tradition,
    sourceLabel: collection.sourceLabel,
    kind: collection.kind,
    workCount: stats.workCount,
    totalChapters: stats.totalChapters,
    completedChapters: currentMeta.completedChapters ?? 0,
    errors: currentMeta.errors ?? 0,
    failedChapters: currentMeta.failedChapters ?? 0,
    sampleError: currentMeta.sampleError ?? '',
    downloadedAt: currentMeta.downloadedAt ?? '',
    inProgress: currentMeta.inProgress ?? false,
    isComplete: currentMeta.isComplete ?? false,
    works,
    ...overrides,
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch (${response.status})`);
  }
  return response.json();
}

async function fetchQuranCatalog(signal) {
  const data = await fetchJson('https://api.alquran.cloud/v1/surah', signal);
  const surahs = Array.isArray(data?.data) ? data.data : [];

  return surahs.map((surah) => ({
    id: String(surah.number),
    title: surah.englishName,
    subtitle: surah.englishNameTranslation,
    reference: `Surah ${surah.number}`,
    description: `${surah.numberOfAyahs} ayahs, ${surah.revelationType}.`,
    chapters: 1,
    totalVerses: surah.numberOfAyahs,
    revelationType: surah.revelationType,
    source: {
      provider: 'alquran.cloud',
      surahNumber: surah.number,
      edition: 'en.pickthall',
    },
  }));
}

async function resolveDynamicCollectionWorks(collection, signal) {
  if (collection.catalogSource === 'quran-api') {
    return fetchQuranCatalog(signal);
  }

  return [];
}

async function fetchQuranChapter(work, signal) {
  const surahNumber = work?.source?.surahNumber;
  if (!surahNumber) {
    throw new Error('This surah is missing its source mapping.');
  }

  const data = await fetchJson(
    `https://api.alquran.cloud/v1/surah/${surahNumber}/${work.source.edition || 'en.pickthall'}`,
    signal
  );

  const verses = normalizeVerses(data?.data?.ayahs, {
    verseKey: 'numberInSurah',
    textKey: 'text',
  });

  if (!hasChapterContent(verses)) {
    throw new Error('This surah response did not include any ayahs.');
  }

  return verses;
}

async function fetchBibleApiChapter(work, chapter, signal) {
  const apiSource = work?.source?.apiSource;
  const bookPath = work?.source?.bookPath;
  if (!apiSource || !bookPath) {
    throw new Error('This work is missing its source mapping.');
  }

  const data = await fetchJson(
    `${apiSource}/${encodeURIComponent(bookPath)}/chapters/${chapter}.json`,
    signal
  );

  const verses = Array.isArray(data?.data)
    ? normalizeVerses(data.data, { verseKey: 'verse', textKey: 'text' })
    : Array.isArray(data)
      ? normalizeVerses(data, { verseKey: 'verse', textKey: 'text' })
      : Array.isArray(data?.verses)
        ? normalizeVerses(data.verses, { verseKey: 'verse', textKey: 'text' })
        : [];

  if (!hasChapterContent(verses)) {
    throw new Error('This chapter response did not include any verses.');
  }

  return verses;
}

async function fetchRemoteBooksChapter(collection, work, chapter, signal) {
  if (collection.id === 'quran') {
    return fetchQuranChapter(work, signal);
  }

  if (work?.source?.provider === 'bible-api') {
    return fetchBibleApiChapter(work, chapter, signal);
  }

  throw new Error(`${collection.name} does not have a downloadable reader source.`);
}

export async function resolveBooksCollectionWorks(collectionId, options = {}) {
  const { signal, cacheOnly = false } = options;
  const collection = getBooksCollectionById(collectionId);
  if (!collection) throw new Error(`Unknown collection: ${collectionId}`);

  if (collectionWorksCache.has(collectionId)) {
    return collectionWorksCache.get(collectionId);
  }

  const staticWorks = getBooksCollectionWorks(collectionId);
  if (staticWorks.length > 0) {
    collectionWorksCache.set(collectionId, staticWorks);
    return staticWorks;
  }

  const currentMeta = await getLibraryCollectionMeta(collectionId);
  if (Array.isArray(currentMeta?.works) && currentMeta.works.length > 0) {
    collectionWorksCache.set(collectionId, currentMeta.works);
    return currentMeta.works;
  }

  if (cacheOnly) {
    return [];
  }

  const works = await resolveDynamicCollectionWorks(collection, signal);
  collectionWorksCache.set(collectionId, works);

  if (works.length > 0) {
    await saveLibraryCollectionMeta(
      collectionId,
      createCollectionMeta(collection, works, currentMeta || {}, {
        catalogUpdatedAt: new Date().toISOString(),
      })
    );
  }

  return works;
}

export async function getBooksWork(collectionId, workId, options = {}) {
  const works = await resolveBooksCollectionWorks(collectionId, options);
  return getBooksWorkById(collectionId, workId, works);
}

export async function fetchBooksChapter(collectionId, workId, chapter, options = {}) {
  const { signal, offlineOnly = false, resolvedWorks = null } = options;
  const cached = await getLibraryChapter(collectionId, workId, chapter);
  if (hasChapterContent(cached)) return cached;

  const collection = getBooksCollectionById(collectionId);
  if (!collection || collection.kind !== 'reader') {
    throw new Error('This collection does not support in-app reading.');
  }

  const works =
    Array.isArray(resolvedWorks) && resolvedWorks.length > 0
      ? resolvedWorks
      : await resolveBooksCollectionWorks(collectionId, { signal, cacheOnly: offlineOnly });
  const work = getBooksWorkById(collectionId, workId, works);

  if (!work) {
    throw new Error('The requested book could not be found in this canon.');
  }

  const normalizedChapter = Math.min(Math.max(Number(chapter) || 1, 1), work.chapters || 1);
  if (offlineOnly) {
    throw new Error('This text is not downloaded yet.');
  }

  const verses = await fetchRemoteBooksChapter(collection, work, normalizedChapter, signal);
  await saveLibraryChapter(collectionId, workId, normalizedChapter, verses);
  return verses;
}

function addProgressListener(record, onProgress, signal) {
  if (typeof onProgress !== 'function') return () => {};

  record.listeners.add(onProgress);
  if (record.progress.total > 0) {
    onProgress(record.progress.done, record.progress.total);
  }

  const unsubscribe = () => {
    record.listeners.delete(onProgress);
  };

  if (signal) {
    if (signal.aborted) {
      unsubscribe();
    } else {
      signal.addEventListener('abort', unsubscribe, { once: true });
    }
  }

  return unsubscribe;
}

function notifyProgress(record, done, total) {
  record.progress = { done, total };
  for (const listener of record.listeners) {
    listener(done, total);
  }
}

function getQueuedInstallPosition(collectionId) {
  const index = queuedInstalls.findIndex((record) => record.collectionId === collectionId);
  return index >= 0 ? index + 1 : null;
}

function getInstallRecordSnapshot(record) {
  return {
    phase: record.phase,
    progress: { ...record.progress },
    queuePosition: record.phase === 'queued' ? getQueuedInstallPosition(record.collectionId) : null,
    reason: record.reason,
  };
}

export function getBooksInstallQueueSnapshot() {
  return {
    activeCollectionId: activeInstallId,
    queuedIds: queuedInstalls.map((record) => record.collectionId),
    jobs: Object.fromEntries(
      Array.from(queuedInstallRecords.entries()).map(([collectionId, record]) => [
        collectionId,
        getInstallRecordSnapshot(record),
      ])
    ),
  };
}

function emitInstallEvent(type, detail = {}) {
  installEventTarget.dispatchEvent(
    new CustomEvent('books-install', {
      detail: {
        type,
        snapshot: getBooksInstallQueueSnapshot(),
        ...detail,
      },
    })
  );
}

export function subscribeToBooksInstallEvents(listener) {
  function handleEvent(event) {
    listener(event.detail);
  }

  installEventTarget.addEventListener('books-install', handleEvent);
  return () => {
    installEventTarget.removeEventListener('books-install', handleEvent);
  };
}

export function getBooksInstallSource(collectionId) {
  const collection = getBooksCollectionById(collectionId);
  return collection?.kind === 'reader' ? 'remote' : null;
}

export function canInstallBooksCollection(collectionId) {
  return getBooksInstallSource(collectionId) === 'remote';
}

async function downloadBooksCollectionNow(collectionId, onProgress, signal) {
  const activeDownload = activeDownloads.get(collectionId);
  if (activeDownload) {
    const unsubscribe = addProgressListener(activeDownload, onProgress, signal);
    return activeDownload.promise.finally(unsubscribe);
  }

  const collection = getBooksCollectionById(collectionId);
  if (!collection) throw new Error(`Unknown collection: ${collectionId}`);
  if (!canInstallBooksCollection(collectionId)) {
    throw new Error(`${collection.name} is not installable in this build.`);
  }

  const works = await resolveBooksCollectionWorks(collectionId, { signal });
  if (!works.length) {
    throw new Error(`No works were available for ${collection.name}.`);
  }

  const chapterTasks = [];
  for (const work of works) {
    for (let chapter = 1; chapter <= (work.chapters || 1); chapter += 1) {
      chapterTasks.push({ work, chapter });
    }
  }

  const downloadRecord = {
    listeners: new Set(),
    progress: { done: 0, total: chapterTasks.length },
    promise: null,
  };
  const unsubscribe = addProgressListener(downloadRecord, onProgress, signal);

  downloadRecord.promise = (async () => {
    const totalChapters = chapterTasks.length;
    let downloaded = 0;
    let completedChapters = 0;
    const errors = [];
    let sampleError = '';
    const downloadedAt = new Date().toISOString();
    let lastPersistedAt = -DOWNLOAD_PROGRESS_SAVE_EVERY;
    let persistQueue = Promise.resolve();
    let nextTaskIndex = 0;
    const concurrency = Math.min(10, totalChapters);

    const existingMeta = await getLibraryCollectionMeta(collectionId);
    notifyProgress(downloadRecord, 0, totalChapters);

    function queueProgressSave(force = false, overrides = {}) {
      if (!force && downloaded - lastPersistedAt < DOWNLOAD_PROGRESS_SAVE_EVERY) {
        return persistQueue;
      }

      lastPersistedAt = downloaded;
      const meta = createCollectionMeta(
        collection,
        works,
        existingMeta || {},
        {
          downloadedAt,
          totalChapters,
          completedChapters,
          errors: errors.length,
          failedChapters: errors.length,
          sampleError,
          inProgress: downloaded < totalChapters,
          isComplete: completedChapters === totalChapters,
          ...overrides,
        }
      );

      persistQueue = persistQueue
        .catch(() => {})
        .then(() => saveLibraryCollectionMeta(collectionId, meta));
      return persistQueue;
    }

    await queueProgressSave(true);

    async function runWorker() {
      while (nextTaskIndex < chapterTasks.length) {
        if (signal?.aborted) throw new Error('Download cancelled');

        const task = chapterTasks[nextTaskIndex];
        nextTaskIndex += 1;

        try {
          const existing = await getLibraryChapter(collectionId, task.work.id, task.chapter);
          if (hasChapterContent(existing)) {
            completedChapters += 1;
          } else {
            const fetched = await fetchBooksChapter(collectionId, task.work.id, task.chapter, {
              signal,
              resolvedWorks: works,
            });
            if (!hasChapterContent(fetched)) {
              throw new Error('No verses were saved for this chapter.');
            }
            completedChapters += 1;
          }
        } catch (error) {
          if (signal?.aborted || error?.name === 'AbortError') {
            throw new Error('Download cancelled');
          }

          const errorMessage = `${task.work.title} ${task.chapter}: ${error.message}`;
          errors.push(errorMessage);
          if (!sampleError) {
            sampleError = errorMessage;
          }
        }

        downloaded += 1;
        notifyProgress(downloadRecord, downloaded, totalChapters);
        queueProgressSave();
      }
    }

    try {
      await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
    } catch (error) {
      await queueProgressSave(true, { inProgress: false, isComplete: false });
      throw error;
    }

    await queueProgressSave(true, { inProgress: false });

    return {
      downloaded,
      totalChapters,
      completedChapters,
      isComplete: completedChapters === totalChapters,
      errors,
      sampleError,
      works,
    };
  })().finally(() => {
    unsubscribe();
    activeDownloads.delete(collectionId);
  });

  activeDownloads.set(collectionId, downloadRecord);
  return downloadRecord.promise;
}

function finalizeInstallRecord(record) {
  if (activeInstallId === record.collectionId) {
    activeInstallId = null;
  }
  queuedInstallRecords.delete(record.collectionId);
}

async function processInstallQueue() {
  if (queueProcessorPromise) return queueProcessorPromise;

  queueProcessorPromise = (async () => {
    while (queuedInstalls.length > 0) {
      const record = queuedInstalls.shift();
      activeInstallId = record.collectionId;
      record.phase = 'active';
      record.controller = new AbortController();

      emitInstallEvent('started', {
        collectionId: record.collectionId,
        reason: record.reason,
      });

      try {
        const result = await downloadBooksCollectionNow(
          record.collectionId,
          (done, total) => {
            notifyProgress(record, done, total);
            emitInstallEvent('progress', {
              collectionId: record.collectionId,
              done,
              total,
              reason: record.reason,
            });
          },
          record.controller.signal
        );

        finalizeInstallRecord(record);
        record.resolve(result);
        emitInstallEvent('completed', {
          collectionId: record.collectionId,
          result,
          reason: record.reason,
        });
      } catch (error) {
        finalizeInstallRecord(record);
        record.reject(error);

        if (error.message === 'Download cancelled') {
          emitInstallEvent('cancelled', {
            collectionId: record.collectionId,
            reason: record.reason,
            phase: 'active',
          });
        } else {
          emitInstallEvent('failed', {
            collectionId: record.collectionId,
            error: error.message,
            reason: record.reason,
          });
        }
      }
    }
  })().finally(() => {
    queueProcessorPromise = null;
  });

  return queueProcessorPromise;
}

export function queueBooksCollectionInstall(
  collectionId,
  { onProgress, signal, reason = 'user' } = {}
) {
  const collection = getBooksCollectionById(collectionId);
  if (!collection) {
    return Promise.reject(new Error(`Unknown collection: ${collectionId}`));
  }
  if (!canInstallBooksCollection(collectionId)) {
    return Promise.reject(new Error(`${collection.name} is not installable in this build.`));
  }

  let record = queuedInstallRecords.get(collectionId);
  if (!record) {
    record = {
      collectionId,
      listeners: new Set(),
      progress: { done: 0, total: 0 },
      promise: null,
      resolve: null,
      reject: null,
      phase: 'queued',
      reason,
      controller: null,
    };

    record.promise = new Promise((resolve, reject) => {
      record.resolve = resolve;
      record.reject = reject;
    });

    queuedInstallRecords.set(collectionId, record);
    queuedInstalls.push(record);
    emitInstallEvent('queued', {
      collectionId,
      reason,
    });
    processInstallQueue();
  } else if (reason === 'user' && record.reason !== 'user') {
    record.reason = 'user';
  }

  const unsubscribe = addProgressListener(record, onProgress, signal);
  return record.promise.finally(unsubscribe);
}

export function cancelBooksCollectionInstall(collectionId) {
  const record = queuedInstallRecords.get(collectionId);
  if (!record) return false;

  if (record.phase === 'queued') {
    const queueIndex = queuedInstalls.findIndex((item) => item.collectionId === collectionId);
    if (queueIndex >= 0) {
      queuedInstalls.splice(queueIndex, 1);
    }
    queuedInstallRecords.delete(collectionId);
    record.reject(new Error('Download cancelled'));
    emitInstallEvent('cancelled', {
      collectionId,
      reason: record.reason,
      phase: 'queued',
    });
    return true;
  }

  if (record.phase === 'active' && record.controller) {
    record.controller.abort();
    return true;
  }

  return false;
}

export async function removeBooksCollection(collectionId) {
  cancelBooksCollectionInstall(collectionId);
  collectionWorksCache.delete(collectionId);
  await deleteLibraryCollectionData(collectionId);
  await deleteLibraryCollectionMeta(collectionId);
}

