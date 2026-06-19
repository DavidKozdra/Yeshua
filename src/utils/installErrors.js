/**
 * Install error message formatting.
 *
 * Turns raw chapter download/install failure strings into concise,
 * human-readable messages for the library UI, normalizing common fetch
 * failures and stripping trailing HTTP status codes.
 */

function stripTrailingStatus(message) {
  return message.replace(/\s+\(\d{3}\)\s*$/u, '').trim();
}

function normalizeFailureReason(reason) {
  if (!reason) return 'Could not fetch this chapter.';

  if (/^Failed to fetch\b/u.test(reason)) {
    return 'Could not fetch this chapter from the source.';
  }

  return stripTrailingStatus(reason);
}

/**
 * Format a raw install/download failure message for display.
 *
 * Splits an optional "location: reason" message, normalizes the reason (mapping
 * generic fetch failures and removing trailing status codes), and produces a
 * readable sentence.
 *
 * @param {string} message Raw failure message.
 * @returns {string} Human-readable issue description (empty string for empty input).
 */
export function formatInstallIssue(message) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) return '';

  const separatorIndex = text.indexOf(': ');
  if (separatorIndex === -1) {
    return normalizeFailureReason(text);
  }

  const location = text.slice(0, separatorIndex).trim();
  const reason = text.slice(separatorIndex + 2).trim();
  const normalizedReason = normalizeFailureReason(reason);

  return location ? `${location} could not be saved. ${normalizedReason}` : normalizedReason;
}
