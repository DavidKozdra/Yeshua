import kjvRedLetters from '../data/kjv-red-letters.json';

const MARKER_PATTERN = /\*([a-z]+)$/i;
const PILCROW_PREFIX = '¶ ';
const PRECISE_TRANSLATION_IDS = new Set(['kjv']);

function parseMarkedTokens(markedText) {
  return String(markedText)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(MARKER_PATTERN);
      const markers = match?.[1] || '';
      return {
        text: token.replace(MARKER_PATTERN, ''),
        isRed: markers.includes('r'),
      };
    });
}

function collapseSegments(segments) {
  const collapsed = [];

  for (const segment of segments) {
    if (!segment.text) continue;

    const lastSegment = collapsed[collapsed.length - 1];
    if (lastSegment && lastSegment.isRed === segment.isRed) {
      lastSegment.text += segment.text;
      continue;
    }

    collapsed.push({ ...segment });
  }

  return collapsed;
}

function getVerseKey(bookId, chapter, verse) {
  return `${bookId}:${chapter}:${verse}`;
}

export function hasWordsOfChristVerse(bookId, chapter, verse) {
  return Object.hasOwn(kjvRedLetters, getVerseKey(bookId, chapter, verse));
}

export function supportsPreciseWordsOfChrist(translationId) {
  return PRECISE_TRANSLATION_IDS.has(translationId);
}

export function getWordsOfChristSegments({
  translationId,
  bookId,
  chapter,
  verse,
  text,
  allowVerseFallback = false,
}) {
  const markedText = kjvRedLetters[getVerseKey(bookId, chapter, verse)];
  if (!markedText) return null;

  const verseText = typeof text === 'string' ? text : '';

  if (!supportsPreciseWordsOfChrist(translationId)) {
    return allowVerseFallback ? [{ text: verseText, isRed: true }] : null;
  }

  const markedTokens = parseMarkedTokens(markedText);
  const hasPilcrowPrefix = verseText.startsWith(PILCROW_PREFIX);
  const currentTokens = verseText
    .replace(/^¶\s+/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const displayTokens =
    currentTokens.length === markedTokens.length
      ? currentTokens
      : markedTokens.map((token) => token.text);

  const segments = hasPilcrowPrefix ? [{ text: PILCROW_PREFIX, isRed: false }] : [];

  for (let index = 0; index < markedTokens.length; index += 1) {
    const prefix = index === 0 ? '' : ' ';
    segments.push({
      text: `${prefix}${displayTokens[index]}`,
      isRed: markedTokens[index].isRed,
    });
  }

  return collapseSegments(segments);
}
