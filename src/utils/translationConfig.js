/**
 * Translation configuration constants and helpers.
 *
 * Defines the app's default and fallback Bible translation identifiers and a
 * helper that produces the ordered list of translations to try when resolving
 * which translation a reader should see.
 */

/**
 * Translation shown by default when no user preference exists.
 * @type {string}
 */
export const DEFAULT_TRANSLATION_ID = 'kjv';

/**
 * Translation used as a last resort when a preferred translation is unavailable.
 * @type {string}
 */
export const FALLBACK_TRANSLATION_ID = 'kjv';

/**
 * Build the de-duplicated, ordered list of translation IDs to attempt, starting
 * with the caller's preferred translation and ending with the fallback.
 * @param {string} [preferredTranslationId=DEFAULT_TRANSLATION_ID] The user's
 *   preferred translation ID.
 * @returns {string[]} Ordered, unique list of translation IDs to try.
 */
export function getTranslationPreferenceChain(preferredTranslationId = DEFAULT_TRANSLATION_ID) {
  return [...new Set([preferredTranslationId, FALLBACK_TRANSLATION_ID])];
}
