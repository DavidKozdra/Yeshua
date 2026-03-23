import { getTranslationById, getBookApiPathCandidates, BIBLE_BOOKS } from './bibleData';
import { saveChapter, getChapter, saveTranslationMeta, deleteTranslationData, deleteTranslationMeta } from './db';
import { normalizeChapterVerses } from './chapterData';
import { DEFAULT_TRANSLATION_ID, getTranslationPreferenceChain } from './translationConfig';

const DOWNLOAD_PROGRESS_SAVE_EVERY = 24;
const bundleLoaders = import.meta.glob('../data/*-bundle.json');
const bundleCache = new Map();
const activeDownloads = new Map();
const resolvedBookPathCache = new Map();

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

export function hasBundledTranslation(translationId) {
  return Boolean(bundleLoaders[getBundleLoaderKey(translationId)]);
}

export function getTranslationInstallSource(translationId) {
  const translation = getTranslationById(translationId);
  if (hasBundledTranslation(translationId)) return 'bundle';
  if (translation?.apiSource) return 'remote';
  return null;
}

export function canInstallTranslation(translationId) {
  return Boolean(getTranslationInstallSource(translationId));
}

export function resolveInstallableTranslationId(
  preferredTranslationId = DEFAULT_TRANSLATION_ID
) {
  return getTranslationPreferenceChain(preferredTranslationId).find(canInstallTranslation) || null;
}

/**
 * Fetch a single chapter from the API or IndexedDB cache
 */
export async function fetchChapter(translationId, bookId, chapter, options = {}) {
  const { signal, offlineOnly = false } = options;

  // Try local cache first
  const cached = await getChapter(translationId, bookId, chapter);
  if (hasChapterContent(cached)) return cached;

  const bundledChapter = await getBundledChapter(translationId, bookId, chapter);
  if (hasChapterContent(bundledChapter)) {
    await saveChapter(translationId, bookId, chapter, bundledChapter);
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
export async function downloadTranslation(translationId, onProgress, signal) {
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

/**
 * Remove a downloaded translation
 */
export async function removeTranslation(translationId) {
  await deleteTranslationData(translationId);
  await deleteTranslationMeta(translationId);
}
