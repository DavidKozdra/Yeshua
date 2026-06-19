/**
 * Words-of-Christ ("red letter") segmentation utilities.
 *
 * Splits verse text into runs flagged as spoken by Jesus so the reader can render
 * those portions in a distinct color. For KJV it uses a precise, per-word marker
 * dataset (kjv-red-letters.json); for other translations it can optionally fall
 * back to a heuristic that attributes quoted spans to Jesus based on nearby
 * speaker phrases. Output is a list of { text, isRed } segments.
 */

import kjvRedLetters from '../data/kjv-red-letters.json';

const MARKER_PATTERN = /\*([a-z]+)$/i;
const PILCROW_PREFIX = '¶ ';
const PRECISE_TRANSLATION_IDS = new Set(['kjv']);
const OPENING_QUOTES = new Set(['“', '„', '«', '‹', '「', '『']);
const CLOSING_QUOTES = new Set(['”', '»', '›', '」', '』']);
const TOGGLE_QUOTES = new Set(['"']);
const JESUS_SPEAKER_PATTERN =
  /\b(jesus|yeshua|yahshua|christ|messiah)\b[\s,;:()-]*(said|says|saith|answered|answers|replied|replies|responded|responds|cried|cries|spoke|speaks|declared|declares|asked|asks|told|tells|commanded|commands|began|begins|continued|continues|called|calls|warned|warns|promised|promises)\b/i;

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

function hasQuoteMarker(text) {
  for (const char of text) {
    if (OPENING_QUOTES.has(char) || CLOSING_QUOTES.has(char) || TOGGLE_QUOTES.has(char)) {
      return true;
    }
  }

  return false;
}

function normalizeSpeakerContext(text) {
  return text
    .toLowerCase()
    .replace(/[{}[\]().!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isQuoteAttributedToJesus(textBeforeQuote, quoteStartIndex) {
  if (quoteStartIndex === 0) {
    return true;
  }

  const context = normalizeSpeakerContext(textBeforeQuote.slice(-120));
  return JESUS_SPEAKER_PATTERN.test(context);
}

function getQuotedTextSegments(text) {
  if (!text || !hasQuoteMarker(text)) {
    return null;
  }

  const hasPilcrowPrefix = text.startsWith(PILCROW_PREFIX);
  const verseText = hasPilcrowPrefix ? text.slice(PILCROW_PREFIX.length) : text;
  const segments = hasPilcrowPrefix ? [{ text: PILCROW_PREFIX, isRed: false }] : [];
  let insideQuote = false;
  let segmentStart = 0;
  let sawRedSegment = false;
  let sawNonRedSegment = false;
  let currentQuoteIsRed = false;

  for (let index = 0; index < verseText.length; index += 1) {
    const char = verseText[index];
    const isOpeningQuote = OPENING_QUOTES.has(char);
    const isClosingQuote = CLOSING_QUOTES.has(char);
    const isToggleQuote = TOGGLE_QUOTES.has(char);

    if (!isOpeningQuote && !isClosingQuote && !isToggleQuote) {
      continue;
    }

    if (isOpeningQuote || (isToggleQuote && !insideQuote)) {
      if (segmentStart < index) {
        segments.push({
          text: verseText.slice(segmentStart, index),
          isRed: false,
        });
        sawNonRedSegment = true;
      }

      insideQuote = true;
      currentQuoteIsRed = isQuoteAttributedToJesus(verseText.slice(0, index), index);
      segmentStart = index;
      continue;
    }

    if (!insideQuote) {
      insideQuote = true;
      currentQuoteIsRed = isQuoteAttributedToJesus(verseText.slice(0, index), index);
    }

    segments.push({
      text: verseText.slice(segmentStart, index + 1),
      isRed: currentQuoteIsRed,
    });
    if (currentQuoteIsRed) {
      sawRedSegment = true;
    } else {
      sawNonRedSegment = true;
    }
    insideQuote = false;
    currentQuoteIsRed = false;
    segmentStart = index + 1;
  }

  if (segmentStart < verseText.length) {
    segments.push({
      text: verseText.slice(segmentStart),
      isRed: insideQuote ? currentQuoteIsRed : false,
    });
    if (insideQuote && currentQuoteIsRed) {
      sawRedSegment = true;
    } else {
      sawNonRedSegment = true;
    }
  }

  if (!sawRedSegment) {
    return null;
  }

  if (!sawNonRedSegment) {
    return collapseSegments(segments);
  }

  return collapseSegments(segments);
}

function getVerseKey(bookId, chapter, verse) {
  return `${bookId}:${chapter}:${verse}`;
}

/**
 * Reports whether the precise red-letter dataset contains an entry for a verse.
 * @param {string} bookId The book identifier (e.g. 'MAT').
 * @param {number} chapter The chapter number.
 * @param {number} verse The verse number.
 * @returns {boolean} True if marked words-of-Christ data exists for the verse.
 */
export function hasWordsOfChristVerse(bookId, chapter, verse) {
  return Object.hasOwn(kjvRedLetters, getVerseKey(bookId, chapter, verse));
}

/**
 * Indicates whether a translation has precise per-word words-of-Christ markers.
 * @param {string} translationId The translation identifier.
 * @returns {boolean} True if precise marking is available (currently KJV only).
 */
export function supportsPreciseWordsOfChrist(translationId) {
  return PRECISE_TRANSLATION_IDS.has(translationId);
}

/**
 * Builds the colored/uncolored segments for a verse's words of Christ.
 *
 * For translations with precise markers, aligns the marker tokens to the current
 * display text. Otherwise, when allowVerseFallback is set, derives segments from
 * quotation marks (attributing quotes to Jesus via speaker heuristics) or marks
 * the whole verse red. Returns null when no red-letter data applies.
 * @param {Object} params Lookup and rendering inputs.
 * @param {string} params.translationId The active translation identifier.
 * @param {string} params.bookId The book identifier.
 * @param {number} params.chapter The chapter number.
 * @param {number} params.verse The verse number.
 * @param {string} params.text The verse text as displayed.
 * @param {boolean} [params.allowVerseFallback=false] Enable the heuristic fallback
 *   for translations without precise markers.
 * @returns {Array<{text: string, isRed: boolean}>|null} Collapsed segments, or null
 *   when the verse has no words of Christ to highlight.
 */
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
    if (!allowVerseFallback) {
      return null;
    }

    if (hasQuoteMarker(verseText)) {
      return getQuotedTextSegments(verseText);
    }

    return [{ text: verseText, isRed: true }];
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
