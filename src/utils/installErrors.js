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
