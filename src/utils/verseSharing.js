/**
 * Verse sharing and deep-link utilities.
 *
 * Parses verse targets and shared-verse metadata out of URLs (query params and
 * hash), builds canonical in-app locations and shareable URLs for a verse, and
 * assembles share payloads. Also implements the share/copy action, using the
 * Web Share API when available and falling back to clipboard copy.
 */

function normalizeVerseNumber(value) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

const SHARE_REFERENCE_QUERY_PARAM = 'shareRef';
const SHARE_TEXT_QUERY_PARAM = 'shareText';
const MAX_SHARE_REFERENCE_LENGTH = 120;
const MAX_SHARE_TEXT_LENGTH = 320;

function normalizeShareValue(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Read the target verse number from a URLSearchParams "verse" parameter.
 * @param {URLSearchParams} searchParams Parsed query parameters.
 * @returns {number|null} A positive integer verse number, or null if absent/invalid.
 */
export function getVerseTargetFromSearchParams(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) {
    return null;
  }

  return normalizeVerseNumber(searchParams.get('verse'));
}

/**
 * Read the target verse number from a raw query string.
 * @param {string} [search=''] A query string (e.g. "?verse=3").
 * @returns {number|null} The verse number, or null if absent/invalid.
 */
export function getVerseTargetFromSearch(search = '') {
  return getVerseTargetFromSearchParams(new URLSearchParams(search));
}

/**
 * Extract sanitized shared-verse metadata (reference and text) from query params.
 * @param {URLSearchParams} searchParams Parsed query parameters.
 * @returns {{reference: string, text: string}} Normalized, length-capped values
 *   (empty strings when absent or invalid).
 */
export function getSharedVerseMetadataFromSearchParams(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) {
    return { reference: '', text: '' };
  }

  return {
    reference: normalizeShareValue(
      searchParams.get(SHARE_REFERENCE_QUERY_PARAM),
      MAX_SHARE_REFERENCE_LENGTH
    ),
    text: normalizeShareValue(searchParams.get(SHARE_TEXT_QUERY_PARAM), MAX_SHARE_TEXT_LENGTH),
  };
}

/**
 * Extract sanitized shared-verse metadata from a raw query string.
 * @param {string} [search=''] A query string.
 * @returns {{reference: string, text: string}} Normalized shared-verse metadata.
 */
export function getSharedVerseMetadataFromSearch(search = '') {
  return getSharedVerseMetadataFromSearchParams(new URLSearchParams(search));
}

/**
 * Read the target verse number from a location hash of the form "#v<number>".
 * @param {string} [hash=''] The location hash.
 * @returns {number|null} The verse number, or null if the hash does not match.
 */
export function getVerseTargetFromHash(hash = '') {
  if (typeof hash !== 'string') {
    return null;
  }

  const match = hash.match(/^#v(\d+)$/i);
  return match ? normalizeVerseNumber(match[1]) : null;
}

/**
 * Resolve the target verse number from a location-like object, preferring the
 * query string and falling back to the hash.
 * @param {{search?: string, hash?: string}} [locationLike={}] A location-like
 *   object (e.g. window.location or a router location).
 * @returns {number|null} The verse number, or null if none is present.
 */
export function getVerseTargetFromLocation(locationLike = {}) {
  return getVerseTargetFromSearch(locationLike.search) || getVerseTargetFromHash(locationLike.hash);
}

/**
 * Build an in-app router location object pointing at a chapter, optionally
 * targeting a specific verse via query param and hash.
 * @param {{translationId: string, bookId: string, chapter: (string|number),
 *   verse?: (string|number)}} params Verse coordinates.
 * @returns {{pathname: string, search?: string, hash?: string}} A location object.
 */
export function buildVerseLocation({ translationId, bookId, chapter, verse }) {
  const location = {
    pathname: `/read/${translationId}/${bookId}/${chapter}`,
  };
  const normalizedVerse = normalizeVerseNumber(verse);

  if (normalizedVerse) {
    location.search = `?verse=${normalizedVerse}`;
    location.hash = `#v${normalizedVerse}`;
  }

  return location;
}

/**
 * Build a fully-qualified, shareable URL for a verse, resolving the origin from
 * the argument or window when omitted.
 * @param {{origin?: string, translationId: string, bookId: string,
 *   chapter: (string|number), verse?: (string|number)}} params URL coordinates.
 * @returns {string} An absolute verse URL.
 */
export function buildVerseUrl({
  origin,
  translationId,
  bookId,
  chapter,
  verse,
}) {
  const resolvedOrigin =
    typeof origin === 'string' && origin.trim()
      ? origin.trim()
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  const url = new URL(`/read/${translationId}/${bookId}/${chapter}`, resolvedOrigin);
  const normalizedVerse = normalizeVerseNumber(verse);

  if (normalizedVerse) {
    url.searchParams.set('verse', String(normalizedVerse));
    url.hash = `v${normalizedVerse}`;
  }

  return url.toString();
}

/**
 * Format a human-readable verse reference such as "John 3:16 (KJV)".
 * @param {{bookName: string, chapter: (string|number), verse: (string|number),
 *   translationLabel?: string}} params Reference parts.
 * @returns {string} The formatted reference, with the translation label appended
 *   in parentheses when provided.
 */
export function buildVerseReference({ bookName, chapter, verse, translationLabel }) {
  const reference = `${bookName} ${chapter}:${verse}`;
  return translationLabel ? `${reference} (${translationLabel})` : reference;
}

function normalizeVerseText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Compose shareable text from the verse text, reference, and URL, omitting any
 * empty parts and separating present parts with blank lines.
 * @param {{verseText?: string, reference?: string, url?: string}} params Share
 *   text components.
 * @returns {string} The assembled share text.
 */
export function buildVerseShareText({ verseText, reference, url }) {
  const lines = [];
  const normalizedVerseText = normalizeVerseText(verseText);

  if (normalizedVerseText) {
    lines.push(normalizedVerseText);
  }

  if (reference) {
    lines.push(reference);
  }

  if (url) {
    lines.push(url);
  }

  return lines.join('\n\n');
}

/**
 * Build the complete share payload for a verse, including reference, title,
 * share text, URL, and a clipboard-friendly copy text (which includes the URL).
 * @param {{origin?: string, translationId: string, bookId: string,
 *   chapter: (string|number), verse: (string|number), verseText?: string,
 *   bookName: string, translationLabel?: string}} params Verse data.
 * @returns {{reference: string, title: string, text: string, url: string,
 *   copyText: string}} A share payload consumable by {@link shareVersePayload}.
 */
export function createVerseSharePayload({
  origin,
  translationId,
  bookId,
  chapter,
  verse,
  verseText,
  bookName,
  translationLabel,
}) {
  const reference = buildVerseReference({
    bookName,
    chapter,
    verse,
    translationLabel,
  });
  const url = buildVerseUrl({
    origin,
    translationId,
    bookId,
    chapter,
    verse,
  });

  return {
    reference,
    title: reference,
    text: buildVerseShareText({
      verseText,
      reference,
    }),
    url,
    copyText: buildVerseShareText({
      verseText,
      reference,
      url,
    }),
  };
}

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to the legacy copy path when clipboard permissions are unavailable.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard access is not available in this environment.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Clipboard access is not available in this browser.');
  }
}

/**
 * Share a verse payload via the Web Share API when available, falling back to
 * copying the payload's copy text to the clipboard.
 * @param {{title: string, text: string, url: string, copyText: string}} payload
 *   A payload produced by {@link createVerseSharePayload}.
 * @returns {Promise<{outcome: 'shared'|'cancelled'|'copied'}>} The result of the
 *   share/copy attempt.
 */
export async function shareVersePayload(payload) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return { outcome: 'shared' };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { outcome: 'cancelled' };
      }
    }
  }

  await copyTextToClipboard(payload.copyText);
  return { outcome: 'copied' };
}
