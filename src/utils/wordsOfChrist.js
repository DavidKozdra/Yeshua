/**
 * Words-of-Christ color utilities.
 *
 * Provides the default highlight color used to render Jesus' spoken words
 * ("red letter" text) and a sanitizer that validates user-supplied hex color
 * values before they are persisted in settings or applied as CSS variables.
 */

const HEX_COLOR_REGEX = /^[0-9a-f]{6}$/i;

/**
 * Default highlight color applied to the words of Christ when the user has not
 * chosen a custom color.
 * @type {string}
 */
export const DEFAULT_WORDS_OF_CHRIST_COLOR = '#e74c3c';

function sanitizeHexColor(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  let normalized = value.trim().replace(/^#/, '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  if (!HEX_COLOR_REGEX.test(normalized)) {
    return fallback;
  }

  return `#${normalized.toLowerCase()}`;
}

/**
 * Validate and normalize a words-of-Christ color value, falling back to the
 * default when the input is not a usable hex color.
 * @param {unknown} value Candidate color (3- or 6-digit hex, with or without '#').
 * @returns {string} A normalized lowercase '#rrggbb' string.
 */
export function sanitizeWordsOfChristColor(value) {
  return sanitizeHexColor(value, DEFAULT_WORDS_OF_CHRIST_COLOR);
}
