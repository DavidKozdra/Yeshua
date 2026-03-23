export const DEFAULT_TRANSLATION_ID = 'nkjv';
export const FALLBACK_TRANSLATION_ID = 'kjv';

export function getTranslationPreferenceChain(preferredTranslationId = DEFAULT_TRANSLATION_ID) {
  return [...new Set([preferredTranslationId, FALLBACK_TRANSLATION_ID])];
}
