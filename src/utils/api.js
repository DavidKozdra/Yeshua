/**
 * Bible translation data layer: fetching chapters and installing whole
 * translations for offline use.
 *
 * Chapter reads (fetchChapter) resolve in priority order — IndexedDB cache,
 * then the in-memory bundle (translations shipped with the build), then the
 * remote API (cached to IndexedDB on success). Whole-translation installs run
 * through a single serial queue: callers enqueue via queueTranslationInstall /
 * downloadTranslation, a background processor downloads one translation at a
 * time with bounded per-translation concurrency, and progress/lifecycle is
 * broadcast through the install EventTarget (subscribe with
 * subscribeToTranslationInstallEvents).
 */
import { getTranslationById, getBookApiPathCandidates, BIBLE_BOOKS } from './bibleData';
import { saveChapter, getChapter, saveTranslationMeta, deleteTranslationData, deleteTranslationMeta } from './db';
import { normalizeChapterVerses } from './chapterData';
import { DEFAULT_TRANSLATION_ID, getTranslationPreferenceChain } from './translationConfig';

const DOWNLOAD_PROGRESS_SAVE_EVERY = 24;
const bundleLoaders = import.meta.glob('../data/*-bundle.json');
const bundleCache = new Map();
const activeDownloads = new Map();
const resolvedBookPathCache = new Map();
const installEventTarget = new EventTarget();
const queuedInstalls = [];
const queuedInstallRecords = new Map();
let activeInstallId = null;
let queueProcessorPromise = null;

function hasChapterContent(chapterData) {
  return Array.isArray(chapterData) && chapterData.length > 0;
}

function extractChapterVerses(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.verses)) {
    return data.verses;
  }

  if (Array.isArray(data?.chapter)) {
    return data.chapter;
  }

  throw new Error('Unexpected API response format');
}

function getResolvedBookPathKey(translationId, bookId) {
  return `${translationId}:${bookId}`;
}

function getBundleLoaderKey(translationId) {
  return `../data/${translationId}-bundle.json`;
}

function getDownloadConcurrency() {
  if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') {
    return Math.min(16, Math.max(6, navigator.hardwareConcurrency * 2));
  }
  return 8;
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

async function getBundledChapter(translationId, bookId, chapter) {
  const bundle = await loadTranslationBundle(translationId);
  if (!bundle) return null;

  const bundledChapter = bundle[`${bookId}:${chapter}`];
  return Array.isArray(bundledChapter) ? normalizeChapterVerses(bundledChapter) : null;
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

function getQueuedInstallPosition(translationId) {
  const index = queuedInstalls.findIndex((record) => record.translationId === translationId);
  return index >= 0 ? index + 1 : null;
}

function getInstallRecordSnapshot(record) {
  return {
    phase: record.phase,
    progress: { ...record.progress },
    queuePosition: record.phase === 'queued' ? getQueuedInstallPosition(record.translationId) : null,
    reason: record.reason,
  };
}

/**
 * Snapshot the current install queue: the active translation, the queued ids,
 * and a per-job record (phase, progress, queue position, reason).
 * @returns {{ activeTranslationId: string|null, queuedIds: string[], jobs: Object }}
 */
export function getTranslationInstallQueueSnapshot() {
  return {
    activeTranslationId: activeInstallId,
    queuedIds: queuedInstalls.map((record) => record.translationId),
    jobs: Object.fromEntries(
      Array.from(queuedInstallRecords.entries()).map(([translationId, record]) => [
        translationId,
        getInstallRecordSnapshot(record),
      ])
    ),
  };
}

function emitInstallEvent(type, detail = {}) {
  installEventTarget.dispatchEvent(
    new CustomEvent('translation-install', {
      detail: {
        type,
        snapshot: getTranslationInstallQueueSnapshot(),
        ...detail,
      },
    })
  );
}

/**
 * Subscribe to translation install lifecycle events (queued, started, progress,
 * completed, cancelled, failed, removed). Each event carries the queue snapshot.
 * @param {(detail: object) => void} listener
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToTranslationInstallEvents(listener) {
  function handleEvent(event) {
    listener(event.detail);
  }

  installEventTarget.addEventListener('translation-install', handleEvent);
  return () => {
    installEventTarget.removeEventListener('translation-install', handleEvent);
  };
}

/**
 * Whether this translation ships as an in-build bundle (vs. remote-only).
 * @param {string} translationId
 * @returns {boolean}
 */
export function hasBundledTranslation(translationId) {
  return Boolean(bundleLoaders[getBundleLoaderKey(translationId)]);
}

/**
 * Where a translation can be installed from: 'bundle', 'remote', or null if it
 * is not installable in this build.
 * @param {string} translationId
 * @returns {'bundle'|'remote'|null}
 */
export function getTranslationInstallSource(translationId) {
  const translation = getTranslationById(translationId);
  if (hasBundledTranslation(translationId)) return 'bundle';
  if (translation?.apiSource) return 'remote';
  return null;
}

/**
 * Whether this translation can be installed (bundled or remote) in this build.
 * @param {string} translationId
 * @returns {boolean}
 */
export function canInstallTranslation(translationId) {
  return Boolean(getTranslationInstallSource(translationId));
}

/**
 * Walk the preference chain for the given translation and return the first id
 * that is actually installable, or null if none are.
 * @param {string} [preferredTranslationId=DEFAULT_TRANSLATION_ID]
 * @returns {string|null}
 */
export function resolveInstallableTranslationId(
  preferredTranslationId = DEFAULT_TRANSLATION_ID
) {
  return getTranslationPreferenceChain(preferredTranslationId).find(canInstallTranslation) || null;
}

/**
 * Resolve a single chapter's verses, trying the IndexedDB cache, then the
 * in-build bundle, then the remote API (caching the API result on success).
 * @param {string} translationId
 * @param {string} bookId
 * @param {number} chapter
 * @param {{ signal?: AbortSignal, offlineOnly?: boolean }} [options]
 *   offlineOnly skips the network and throws if the chapter is not local.
 * @returns {Promise<Array<{ verse: number, text: string }>>}
 */
export async function fetchChapter(translationId, bookId, chapter, options = {}) {
  const { signal, offlineOnly = false } = options;

  // Try local cache first
  const cached = await getChapter(translationId, bookId, chapter);
  if (hasChapterContent(cached)) return cached;

  // Bundled chapters are served from the in-memory bundle cache, so there is no
  // need to copy them into IndexedDB (doing so would duplicate the entire
  // translation into storage just by reading it).
  const bundledChapter = await getBundledChapter(translationId, bookId, chapter);
  if (hasChapterContent(bundledChapter)) {
    return bundledChapter;
  }

  // Fetch from API
  const translation = getTranslationById(translationId);
  if (!translation) throw new Error(`Unknown translation: ${translationId}`);
  if (offlineOnly) throw new Error('This chapter is not downloaded yet.');
  if (!translation.apiSource) {
    throw new Error(`${translation.abbreviation} is not installable in this build.`);
  }

  const pathCacheKey = getResolvedBookPathKey(translationId, bookId);
  const cachedBookPath = resolvedBookPathCache.get(pathCacheKey);
  const bookPathCandidates = [
    ...(cachedBookPath ? [cachedBookPath] : []),
    ...getBookApiPathCandidates(bookId).filter((path) => path !== cachedBookPath),
  ];

  let res = null;
  let failedStatus = null;

  for (const bookPathCandidate of bookPathCandidates) {
    const url = `${translation.apiSource}/${encodeURIComponent(bookPathCandidate)}/chapters/${chapter}.json`;
    const candidateResponse = await fetch(url, { signal });

    if (candidateResponse.status === 404) {
      continue;
    }

    if (!candidateResponse.ok) {
      failedStatus = candidateResponse.status;
      break;
    }

    res = candidateResponse;
    resolvedBookPathCache.set(pathCacheKey, bookPathCandidate);
    break;
  }

  if (!res) {
    const firstBookPath = bookPathCandidates[0] || bookId.toLowerCase();
    throw new Error(
      `Failed to fetch ${firstBookPath} ${chapter} (${failedStatus ?? 404})`
    );
  }

  const data = await res.json();

  const verses = extractChapterVerses(data).map((v) => ({
    verse: v.verse,
    text: v.text,
  }));

  const normalizedVerses = normalizeChapterVerses(verses);
  if (!hasChapterContent(normalizedVerses)) {
    throw new Error('This chapter response did not contain any verses.');
  }

  // Cache locally
  await saveChapter(translationId, bookId, chapter, normalizedVerses);
  return normalizedVerses;
}

/**
 * Download an entire translation for offline use
 * Calls onProgress(downloaded, total) during download
 */
async function downloadTranslationNow(translationId, onProgress, signal) {
  const activeDownload = activeDownloads.get(translationId);
  if (activeDownload) {
    const unsubscribe = addProgressListener(activeDownload, onProgress, signal);
    return activeDownload.promise.finally(unsubscribe);
  }

  const translation = getTranslationById(translationId);
  if (!translation) throw new Error(`Unknown translation: ${translationId}`);
  if (!canInstallTranslation(translationId)) {
    throw new Error(`${translation.abbreviation} is not installable in this build.`);
  }

  const downloadRecord = {
    listeners: new Set(),
    progress: { done: 0, total: 0 },
    promise: null,
  };
  const unsubscribe = addProgressListener(downloadRecord, onProgress, signal);

  downloadRecord.promise = (async () => {
    const chapterTasks = [];
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        chapterTasks.push({ book, chapter });
      }
    }

    const totalChapters = chapterTasks.length;
    let downloaded = 0;
    let completedChapters = 0;
    const errors = [];
    let sampleError = '';
    const downloadedAt = new Date().toISOString();
    const concurrency = Math.min(getDownloadConcurrency(), totalChapters);
    let nextTaskIndex = 0;
    let lastPersistedAt = -DOWNLOAD_PROGRESS_SAVE_EVERY;
    let persistQueue = Promise.resolve();

    notifyProgress(downloadRecord, 0, totalChapters);

    function queueProgressSave(force = false, overrides = {}) {
      if (!force && downloaded - lastPersistedAt < DOWNLOAD_PROGRESS_SAVE_EVERY) return persistQueue;
      lastPersistedAt = downloaded;

      const meta = {
        name: translation.name,
        abbreviation: translation.abbreviation,
        language: translation.language,
        downloadedAt,
        totalChapters,
        completedChapters,
        errors: errors.length,
        failedChapters: errors.length,
        sampleError,
        isComplete: completedChapters === totalChapters,
        inProgress: downloaded < totalChapters,
        ...overrides,
      };

      persistQueue = persistQueue
        .catch(() => {})
        .then(() => saveTranslationMeta(translationId, meta));
      return persistQueue;
    }

    await queueProgressSave(true);

    async function runWorker() {
      while (nextTaskIndex < chapterTasks.length) {
        if (signal?.aborted) throw new Error('Download cancelled');

        const task = chapterTasks[nextTaskIndex];
        nextTaskIndex += 1;
        const { book, chapter } = task;

        try {
          const existing = await getChapter(translationId, book.id, chapter);
          if (hasChapterContent(existing)) {
            completedChapters++;
          } else {
            const fetchedChapter = await fetchChapter(translationId, book.id, chapter, { signal });
            if (!hasChapterContent(fetchedChapter)) {
              throw new Error('No verses were saved for this chapter.');
            }
            completedChapters++;
          }
        } catch (err) {
          if (signal?.aborted || err?.name === 'AbortError') {
            throw new Error('Download cancelled');
          }
          const errorMessage = `${book.name} ${chapter}: ${err.message}`;
          errors.push(errorMessage);
          if (!sampleError) {
            sampleError = errorMessage;
          }
        }

        downloaded++;
        notifyProgress(downloadRecord, downloaded, totalChapters);
        queueProgressSave();
      }
    }

    try {
      await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
    } catch (err) {
      await queueProgressSave(true, { inProgress: false, isComplete: false });
      throw err;
    }

    await queueProgressSave(true, { inProgress: false });

    return {
      downloaded,
      totalChapters,
      completedChapters,
      isComplete: completedChapters === totalChapters,
      errors,
      sampleError,
    };
  })().finally(() => {
    unsubscribe();
    activeDownloads.delete(translationId);
  });

  activeDownloads.set(translationId, downloadRecord);
  return downloadRecord.promise;
}

function finalizeInstallRecord(record) {
  if (activeInstallId === record.translationId) {
    activeInstallId = null;
  }
  queuedInstallRecords.delete(record.translationId);
}

async function processInstallQueue() {
  if (queueProcessorPromise) return queueProcessorPromise;

  queueProcessorPromise = (async () => {
    while (queuedInstalls.length > 0) {
      const record = queuedInstalls.shift();
      activeInstallId = record.translationId;
      record.phase = 'active';
      record.controller = new AbortController();

      emitInstallEvent('started', {
        translationId: record.translationId,
        reason: record.reason,
      });

      try {
        const result = await downloadTranslationNow(
          record.translationId,
          (done, total) => {
            notifyProgress(record, done, total);
            emitInstallEvent('progress', {
              translationId: record.translationId,
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
          translationId: record.translationId,
          result,
          reason: record.reason,
        });
      } catch (err) {
        finalizeInstallRecord(record);
        record.reject(err);

        if (err.message === 'Download cancelled') {
          emitInstallEvent('cancelled', {
            translationId: record.translationId,
            reason: record.reason,
            phase: 'active',
          });
        } else {
          emitInstallEvent('failed', {
            translationId: record.translationId,
            error: err.message,
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

/**
 * Enqueue a full-translation install (idempotent per translation: re-queuing one
 * already in the queue reuses the existing job). The queue processes one
 * translation at a time. Resolves with the download result when complete.
 * @param {string} translationId
 * @param {{ onProgress?: (done: number, total: number) => void, signal?: AbortSignal, reason?: string }} [options]
 *   reason ('user' | other) lets a passive prefetch be promoted to a user request.
 * @returns {Promise<object>} Download summary (counts, errors, completeness).
 */
export function queueTranslationInstall(
  translationId,
  { onProgress, signal, reason = 'user' } = {}
) {
  const translation = getTranslationById(translationId);
  if (!translation) {
    return Promise.reject(new Error(`Unknown translation: ${translationId}`));
  }
  if (!canInstallTranslation(translationId)) {
    return Promise.reject(new Error(`${translation.abbreviation} is not installable in this build.`));
  }

  let record = queuedInstallRecords.get(translationId);
  if (!record) {
    record = {
      translationId,
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

    queuedInstallRecords.set(translationId, record);
    queuedInstalls.push(record);

    emitInstallEvent('queued', {
      translationId,
      reason,
    });

    processInstallQueue();
  } else if (reason === 'user' && record.reason !== 'user') {
    record.reason = 'user';
  }

  const unsubscribe = addProgressListener(record, onProgress, signal);
  return record.promise.finally(unsubscribe);
}

/**
 * Convenience wrapper over queueTranslationInstall with positional arguments.
 * @param {string} translationId
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
export function downloadTranslation(translationId, onProgress, signal) {
  return queueTranslationInstall(translationId, { onProgress, signal });
}

/**
 * Cancel a queued or active translation install. Removes a queued job outright,
 * or aborts the in-flight download for an active one.
 * @param {string} translationId
 * @returns {boolean} True if a job was found and cancellation was initiated.
 */
export function cancelTranslationInstall(translationId) {
  const record = queuedInstallRecords.get(translationId);
  if (!record) return false;

  if (record.phase === 'queued') {
    const queueIndex = queuedInstalls.findIndex((item) => item.translationId === translationId);
    if (queueIndex >= 0) {
      queuedInstalls.splice(queueIndex, 1);
    }

    finalizeInstallRecord(record);
    record.reject(new Error('Download cancelled'));
    emitInstallEvent('cancelled', {
      translationId,
      reason: record.reason,
      phase: 'queued',
    });
    return true;
  }

  if (record.phase === 'active') {
    record.controller?.abort();
    return true;
  }

  return false;
}

/**
 * Remove a downloaded translation: cancels any in-flight install, deletes its
 * cached chapter data and metadata from IndexedDB, and emits a 'removed' event.
 * @param {string} translationId
 * @returns {Promise<void>}
 */
export async function removeTranslation(translationId) {
  const queuedRecord = queuedInstallRecords.get(translationId);
  if (queuedRecord) {
    cancelTranslationInstall(translationId);
    await queuedRecord.promise.catch(() => {});
  }

  await deleteTranslationData(translationId);
  await deleteTranslationMeta(translationId);
  emitInstallEvent('removed', { translationId });
}
