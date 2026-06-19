/**
 * Server-side per-verse SEO override resolution.
 *
 * Runs in the Node SSR/prerender layer to enrich /read deep links that target a
 * specific verse with the actual verse text. It reads chapter data from local
 * translation bundles first and falls back to the translation's remote API,
 * caching bundles, resolved book paths, and chapters in memory. Produces an SEO
 * override (title, description, breadcrumbs) when a valid verse is found.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeChapterVerses } from './chapterData.js';
import { getBookApiPathCandidates, getBookById, getTranslationById } from './bibleData.js';
import { formatTitle } from './seo.js';
import { buildVerseReference, getVerseTargetFromSearchParams } from './verseSharing.js';

const bundleCache = new Map();
const chapterCache = new Map();
const resolvedBookPathCache = new Map();

const CHAPTER_CACHE_MAX = 200;

function setCachedChapter(key, value) {
  if (chapterCache.size >= CHAPTER_CACHE_MAX) {
    chapterCache.delete(chapterCache.keys().next().value);
  }
  chapterCache.set(key, value);
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

  return [];
}

function getBundlePath(translationId) {
  return fileURLToPath(new URL(`../data/${translationId}-bundle.json`, import.meta.url));
}

async function loadTranslationBundle(translationId) {
  if (!bundleCache.has(translationId)) {
    bundleCache.set(
      translationId,
      (async () => {
        try {
          const raw = await readFile(getBundlePath(translationId), 'utf8');
          return JSON.parse(raw);
        } catch (error) {
          if (error?.code === 'ENOENT') {
            return null;
          }

          throw error;
        }
      })()
    );
  }

  return bundleCache.get(translationId);
}

async function getBundledChapter(translationId, bookId, chapter) {
  const bundle = await loadTranslationBundle(translationId);
  if (!bundle) {
    return null;
  }

  const bundledChapter = bundle[`${bookId}:${chapter}`];
  return Array.isArray(bundledChapter) ? normalizeChapterVerses(bundledChapter) : null;
}

function getResolvedBookPathKey(translationId, bookId) {
  return `${translationId}:${bookId}`;
}

async function fetchRemoteChapter(translationId, bookId, chapter) {
  const translation = getTranslationById(translationId);
  if (!translation?.apiSource) {
    return null;
  }

  const cacheKey = getResolvedBookPathKey(translationId, bookId);
  const cachedBookPath = resolvedBookPathCache.get(cacheKey);
  const bookPathCandidates = [
    ...(cachedBookPath ? [cachedBookPath] : []),
    ...getBookApiPathCandidates(bookId).filter((path) => path !== cachedBookPath),
  ];

  for (const bookPath of bookPathCandidates) {
    const url = `${translation.apiSource}/${encodeURIComponent(bookPath)}/chapters/${chapter}.json`;

    let response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      continue;
    }

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      continue;
    }

    resolvedBookPathCache.set(cacheKey, bookPath);

    try {
      const payload = await response.json();
      const chapterVerses = normalizeChapterVerses(extractChapterVerses(payload));
      return chapterVerses.length > 0 ? chapterVerses : null;
    } catch {
      return null;
    }
  }

  return null;
}

async function getServerChapter(translationId, bookId, chapter) {
  const cacheKey = `${translationId}:${bookId}:${chapter}`;
  if (!chapterCache.has(cacheKey)) {
    setCachedChapter(
      cacheKey,
      (async () => {
        const bundledChapter = await getBundledChapter(translationId, bookId, chapter);
        if (bundledChapter?.length) {
          return bundledChapter;
        }

        return fetchRemoteChapter(translationId, bookId, chapter);
      })()
    );
  }

  return chapterCache.get(cacheKey);
}

/**
 * Resolves a verse-specific SEO override for a /read deep link, when applicable.
 *
 * Returns null unless the path is a reader route targeting a specific verse and
 * the referenced translation, book, chapter, and verse all resolve to real text.
 * @param {Object} location The request location.
 * @param {string} location.pathname The URL path (expected /read/<tr>/<book>/<ch>).
 * @param {URLSearchParams} location.searchParams Query params (provides the verse).
 * @returns {Promise<{title: string, description: string, imageAlt: string,
 *   breadcrumbs: Array<{name: string, path: string}>}|null>} The SEO override, or
 *   null when no verse override applies.
 */
export async function getServerVerseSeoOverride({ pathname, searchParams }) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'read' || segments.length < 4) {
    return null;
  }

  const verse = getVerseTargetFromSearchParams(searchParams);
  if (!verse) {
    return null;
  }

  const translationId = segments[1];
  const bookId = segments[2];
  const chapter = Number.parseInt(segments[3], 10);
  const translation = getTranslationById(translationId);
  const book = getBookById(bookId);

  if (!translation || !book || Number.isNaN(chapter) || chapter < 1) {
    return null;
  }

  const chapterVerses = await getServerChapter(translationId, bookId, chapter);
  const verseEntry = chapterVerses?.find((entry) => entry.verse === verse);
  if (!verseEntry?.text) {
    return null;
  }

  const reference = buildVerseReference({
    bookName: book.name,
    chapter,
    verse,
    translationLabel: translation.abbreviation,
  });

  return {
    title: formatTitle(reference),
    description: verseEntry.text.replace(/\s+/g, ' ').trim(),
    imageAlt: reference,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Read', path: '/read' },
      { name: reference, path: `/read/${translationId}/${bookId}/${chapter}?verse=${verse}` },
    ],
  };
}
