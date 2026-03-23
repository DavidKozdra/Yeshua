import { canInstallBooksCollection, getBooksInstallSource } from './booksApi';

function getQueuedDetailLabel(queueJob) {
  if (queueJob?.queuePosition > 1) {
    const collectionsAhead = queueJob.queuePosition - 1;
    return `${collectionsAhead} collection${collectionsAhead === 1 ? '' : 's'} ${collectionsAhead === 1 ? 'is' : 'are'} ahead in the queue.`;
  }

  return 'This collection will start saving as soon as the current queue clears.';
}

function hasSavedContent(meta) {
  return Boolean(meta?.downloadedAt) || (meta?.completedChapters ?? 0) > 0;
}

export function getBooksCollectionStatus(collection, meta, queueJob = null) {
  const installSource = getBooksInstallSource(collection.id);
  const isExternal = collection.kind === 'external';
  const isBible = collection.kind === 'bible';
  const isSavedOnDevice = meta?.isComplete === true;
  const isQueued = queueJob?.phase === 'queued';
  const isInstalling = queueJob?.phase === 'active' || meta?.inProgress === true;
  const isPartial = hasSavedContent(meta) && !isSavedOnDevice && !isInstalling;

  let badgeLabels = [];
  let statusLabel = '';
  let detailLabel = '';
  let actionLabel = '';
  let removeLabel = 'Remove saved copy';
  let tone = 'default';

  if (isBible) {
    badgeLabels = ['Primary reader'];
    statusLabel = 'Uses the Bible reader';
    detailLabel = 'Bible downloads, notes, and translation installs continue to live in the existing Bible flow.';
    actionLabel = 'Open Bible reader';
    tone = 'ready';
  } else if (isExternal) {
    badgeLabels = ['Linked library'];
    statusLabel = 'Source links only';
    detailLabel = 'This collection opens official or archival sources in a new tab instead of downloading local copies.';
    actionLabel = 'Open source links';
    tone = 'default';
  } else if (isQueued) {
    badgeLabels = ['Queued'];
    statusLabel = 'Queued for download';
    detailLabel = getQueuedDetailLabel(queueJob);
    actionLabel = 'Queued';
    tone = 'progress';
  } else if (isInstalling) {
    badgeLabels = ['Saving to device'];
    statusLabel = 'Saving to device';
    detailLabel = 'The app is caching the full canon to this device for offline reading.';
    actionLabel = 'Saving';
    tone = 'progress';
  } else if (isSavedOnDevice) {
    badgeLabels = ['Read now', 'Saved on device'];
    statusLabel = 'Saved on device';
    detailLabel = 'Every chapter in this canon is stored locally for offline reading.';
    actionLabel = 'Saved';
    tone = 'ready';
  } else if (isPartial) {
    badgeLabels = ['Partially saved'];
    statusLabel = 'Partially saved';
    detailLabel =
      typeof meta?.completedChapters === 'number' && typeof meta?.totalChapters === 'number'
        ? `${meta.completedChapters} / ${meta.totalChapters} chapters are saved locally.`
        : 'Some chapters are cached, but the canon is not fully saved yet.';
    if (meta?.sampleError) {
      detailLabel = `${detailLabel} Last issue: ${meta.sampleError}`;
    }
    actionLabel = 'Resume';
    tone = 'progress';
  } else if (installSource === 'remote') {
    badgeLabels = ['Stream online', 'Download available'];
    statusLabel = 'Available online';
    detailLabel = 'Open the text immediately over the network, or download the full canon for offline use.';
    actionLabel = 'Download canon';
    tone = 'pending';
  } else {
    badgeLabels = ['Unavailable'];
    statusLabel = 'Not available in this build';
    detailLabel = 'This collection needs a supported text source before it can be downloaded here.';
    actionLabel = 'Unavailable';
    tone = 'unavailable';
  }

  return {
    actionLabel,
    badgeLabels,
    canInstall: canInstallBooksCollection(collection.id),
    canOpenReader: collection.kind === 'bible' || collection.kind === 'reader',
    detailLabel,
    installSource,
    isExternal,
    isInstalling,
    isPartial,
    isQueued,
    isSavedOnDevice,
    removeLabel,
    statusLabel,
    tone,
  };
}
