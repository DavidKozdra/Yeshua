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

export function getVerseTargetFromSearchParams(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) {
    return null;
  }

  return normalizeVerseNumber(searchParams.get('verse'));
}

export function getVerseTargetFromSearch(search = '') {
  return getVerseTargetFromSearchParams(new URLSearchParams(search));
}

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

export function getSharedVerseMetadataFromSearch(search = '') {
  return getSharedVerseMetadataFromSearchParams(new URLSearchParams(search));
}

export function getVerseTargetFromHash(hash = '') {
  if (typeof hash !== 'string') {
    return null;
  }

  const match = hash.match(/^#v(\d+)$/i);
  return match ? normalizeVerseNumber(match[1]) : null;
}

export function getVerseTargetFromLocation(locationLike = {}) {
  return getVerseTargetFromSearch(locationLike.search) || getVerseTargetFromHash(locationLike.hash);
}

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

export function buildVerseUrl({
  origin,
  translationId,
  bookId,
  chapter,
  verse,
  shareReference,
  shareText,
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

  const normalizedShareReference = normalizeShareValue(
    shareReference,
    MAX_SHARE_REFERENCE_LENGTH
  );
  const normalizedShareText = normalizeShareValue(shareText, MAX_SHARE_TEXT_LENGTH);

  if (normalizedShareReference) {
    url.searchParams.set(SHARE_REFERENCE_QUERY_PARAM, normalizedShareReference);
  }

  if (normalizedShareText) {
    url.searchParams.set(SHARE_TEXT_QUERY_PARAM, normalizedShareText);
  }

  return url.toString();
}

export function buildVerseReference({ bookName, chapter, verse, translationLabel }) {
  const reference = `${bookName} ${chapter}:${verse}`;
  return translationLabel ? `${reference} (${translationLabel})` : reference;
}

function normalizeVerseText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

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
    shareReference: reference,
    shareText: verseText,
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
