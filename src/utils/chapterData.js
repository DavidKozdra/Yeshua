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
