import { canInstallBooksCollection, getBooksInstallSource } from './booksApi';
import { formatInstallIssue } from './installErrors';

const REMOVE_LABEL = 'Remove saved copy';

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

function getPartialDetailLabel(meta) {
  let detail =
    typeof meta?.completedChapters === 'number' && typeof meta?.totalChapters === 'number'
      ? `${meta.completedChapters} / ${meta.totalChapters} chapters are saved locally. Resume to retry skipped chapters.`
      : 'Some chapters are cached, but the canon is not fully saved yet.';
  if (meta?.sampleError) {
    detail = `${detail} Latest skipped chapter: ${formatInstallIssue(meta.sampleError)}`;
  }
  return detail;
}

function resolveStatusConfig({ isBible, isExternal, isQueued, isInstalling, isSavedOnDevice, isPartial, installSource, meta, queueJob }) {
  if (isBible) {
    return {
      badgeLabels: ['Primary reader'],
      statusLabel: 'Uses the Bible reader',
      detailLabel: 'Bible downloads, notes, and translation installs continue to live in the existing Bible flow.',
      actionLabel: 'Open Bible reader',
      tone: 'ready',
    };
  }

  if (isExternal) {
    return {
      badgeLabels: ['Linked library'],
      statusLabel: 'Source links only',
      detailLabel: 'This collection opens official or archival sources in a new tab instead of downloading local copies.',
      actionLabel: 'Open source links',
      tone: 'default',
    };
  }

  if (isQueued) {
    return {
      badgeLabels: ['Queued'],
      statusLabel: 'Queued for download',
      detailLabel: getQueuedDetailLabel(queueJob),
      actionLabel: 'Queued',
      tone: 'progress',
    };
  }

  if (isInstalling) {
    return {
      badgeLabels: ['Saving to device'],
      statusLabel: 'Saving to device',
      detailLabel: 'The app is caching the full canon to this device for offline reading.',
      actionLabel: 'Saving',
      tone: 'progress',
    };
  }

  if (isSavedOnDevice) {
    return {
      badgeLabels: ['Read now', 'Saved on device'],
      statusLabel: 'Saved on device',
      detailLabel: 'Every chapter in this canon is stored locally for offline reading.',
      actionLabel: 'Saved',
      tone: 'ready',
    };
  }

  if (isPartial) {
    return {
      badgeLabels: ['Partially saved'],
      statusLabel: 'Partially saved',
      detailLabel: getPartialDetailLabel(meta),
      actionLabel: 'Resume',
      tone: 'progress',
    };
  }

  if (installSource === 'remote') {
    return {
      badgeLabels: ['Stream online', 'Download available'],
      statusLabel: 'Available online',
      detailLabel: 'Open the text immediately over the network, or download the full canon for offline use.',
      actionLabel: 'Download canon',
      tone: 'pending',
    };
  }

  return {
    badgeLabels: ['Unavailable'],
    statusLabel: 'Not available in this build',
    detailLabel: 'This collection needs a supported text source before it can be downloaded here.',
    actionLabel: 'Unavailable',
    tone: 'unavailable',
  };
}

export function getBooksCollectionStatus(collection, meta, queueJob = null) {
  const installSource = getBooksInstallSource(collection.id);
  const isBible = collection.kind === 'bible';
  const isExternal = collection.kind === 'external';
  const isSavedOnDevice = meta?.isComplete === true;
  const isQueued = queueJob?.phase === 'queued';
  const isInstalling = queueJob?.phase === 'active' || meta?.inProgress === true;
  const isPartial = hasSavedContent(meta) && !isSavedOnDevice && !isInstalling;

  const config = resolveStatusConfig({
    isBible, isExternal, isQueued, isInstalling, isSavedOnDevice, isPartial,
    installSource, meta, queueJob,
  });

  return {
    ...config,
    canInstall: canInstallBooksCollection(collection.id),
    canOpenReader: isBible || collection.kind === 'reader',
    installSource,
    isExternal,
    isInstalling,
    isPartial,
    isQueued,
    isSavedOnDevice,
    removeLabel: REMOVE_LABEL,
  };
}
