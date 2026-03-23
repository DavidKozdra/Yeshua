import { getTranslationById, getBookApiPath, BIBLE_BOOKS } from './bibleData';
import { saveChapter, getChapter, saveTranslationMeta, deleteTranslationData, deleteTranslationMeta } from './db';

/**
 * Fetch a single chapter from the API or IndexedDB cache
 */
export async function fetchChapter(translationId, bookId, chapter) {
  // Try local cache first
  const cached = await getChapter(translationId, bookId, chapter);
  if (cached) return cached;

  // Fetch from API
  const translation = getTranslationById(translationId);
  if (!translation) throw new Error(`Unknown translation: ${translationId}`);

  const bookPath = getBookApiPath(bookId);
  const url = `${translation.apiSource}/${encodeURIComponent(bookPath)}/chapters/${chapter}.json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${bookPath} ${chapter} (${res.status})`);

  const data = await res.json();

  // Normalize verses into [{verse, text}]
  let verses;
  if (Array.isArray(data)) {
    verses = data.map((v) => ({
      verse: v.verse,
      text: v.text,
    }));
  } else if (data.verses) {
    verses = data.verses.map((v) => ({
      verse: v.verse,
      text: v.text,
    }));
  } else {
    throw new Error('Unexpected API response format');
  }

  // Cache locally
  await saveChapter(translationId, bookId, chapter, verses);
  return verses;
}

/**
 * Download an entire translation for offline use
 * Calls onProgress(downloaded, total) during download
 */
export async function downloadTranslation(translationId, onProgress, signal) {
  const translation = getTranslationById(translationId);
  if (!translation) throw new Error(`Unknown translation: ${translationId}`);

  let totalChapters = 0;
  for (const book of BIBLE_BOOKS) totalChapters += book.chapters;

  let downloaded = 0;
  const errors = [];

  for (const book of BIBLE_BOOKS) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      if (signal?.aborted) throw new Error('Download cancelled');

      try {
        // Check if already cached
        const existing = await getChapter(translationId, book.id, ch);
        if (!existing) {
          await fetchChapter(translationId, book.id, ch);
        }
      } catch (err) {
        errors.push(`${book.name} ${ch}: ${err.message}`);
      }

      downloaded++;
      onProgress?.(downloaded, totalChapters);
    }
  }

  // Save translation metadata
  await saveTranslationMeta(translationId, {
    name: translation.name,
    abbreviation: translation.abbreviation,
    language: translation.language,
    downloadedAt: new Date().toISOString(),
    errors: errors.length,
  });

  return { downloaded, totalChapters, errors };
}

/**
 * Remove a downloaded translation
 */
export async function removeTranslation(translationId) {
  await deleteTranslationData(translationId);
  await deleteTranslationMeta(translationId);
}
