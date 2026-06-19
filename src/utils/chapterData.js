/**
 * Chapter verse data helpers.
 *
 * Pure utilities for normalizing and comparing arrays of verse records used
 * throughout the Bible/library storage layer. Normalization enforces a clean,
 * de-duplicated, ascending-by-verse shape so cached chapters stay consistent.
 */

/**
 * Normalize an array of verse entries into a clean, sorted list.
 *
 * Drops entries without a valid positive integer verse number and removes
 * duplicate verse numbers, coerces text to a string, and sorts ascending by
 * verse.
 *
 * @param {Array<{verse: any, text: any}>} verses Raw verse entries.
 * @returns {Array<{verse: number, text: string}>} Normalized verse list (empty
 *   array if input is not an array).
 */
export function normalizeChapterVerses(verses) {
  if (!Array.isArray(verses)) return [];

  const normalized = [];
  const seenVerses = new Set();

  for (const entry of verses) {
    const verse = Number(entry?.verse);
    if (!Number.isInteger(verse) || verse < 1 || seenVerses.has(verse)) {
      continue;
    }

    seenVerses.add(verse);
    normalized.push({
      verse,
      text: typeof entry?.text === 'string' ? entry.text : String(entry?.text ?? ''),
    });
  }

  normalized.sort((left, right) => left.verse - right.verse);
  return normalized;
}

/**
 * Determine whether two verse lists are equal.
 *
 * Compares length and each entry's verse number and text in order.
 *
 * @param {Array<{verse: any, text: any}>} left First verse list.
 * @param {Array<{verse: any, text: any}>} right Second verse list.
 * @returns {boolean} True if both lists are equivalent.
 */
export function chapterVersesEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index]?.verse !== right[index]?.verse ||
      left[index]?.text !== right[index]?.text
    ) {
      return false;
    }
  }

  return true;
}
