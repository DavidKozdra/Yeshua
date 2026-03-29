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
