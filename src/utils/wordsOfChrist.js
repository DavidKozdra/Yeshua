const HEX_COLOR_REGEX = /^[0-9a-f]{6}$/i;
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

export function sanitizeWordsOfChristColor(value) {
  return sanitizeHexColor(value, DEFAULT_WORDS_OF_CHRIST_COLOR);
}
