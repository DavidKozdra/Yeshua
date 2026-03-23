import { canInstallTranslation, getTranslationInstallSource } from './api';

export function getTranslationStatus(translationId, meta) {
  const installSource = getTranslationInstallSource(translationId);
  const isBundled = installSource === 'bundle';
  const isSavedOnDevice = meta?.isComplete === true;
  const isInstalling = meta?.inProgress === true;
  const isPartial = Boolean(meta) && !isSavedOnDevice;
  const canReadNow = isBundled || isSavedOnDevice;

  let badgeLabels = [];
  let statusLabel = '';
  let detailLabel = '';
  let actionLabel = '';
  let removeLabel = 'Remove';
  let tone = 'default';

  if (isInstalling) {
    badgeLabels = isBundled
      ? ['Ready now', 'Included with app', 'Saving to device']
      : ['Installing'];
    statusLabel = isBundled ? 'Included with app, saving to device' : 'Installing now';
    detailLabel = isBundled
      ? 'You can already read this translation. The app is now saving every chapter to device storage.'
      : 'The app is saving every chapter to this device for offline reading.';
    actionLabel = isBundled ? 'Saving to device' : 'Installing';
    tone = 'progress';
  } else if (isSavedOnDevice && isBundled) {
    badgeLabels = ['Ready now', 'Included with app', 'Saved on device'];
    statusLabel = 'Included with app and saved on device';
    detailLabel = 'This translation opens immediately and every chapter is also cached in device storage.';
    actionLabel = 'Saved on device';
    removeLabel = 'Remove saved copy';
    tone = 'ready';
  } else if (isSavedOnDevice) {
    badgeLabels = ['Ready now', 'Saved on device'];
    statusLabel = 'Saved on device';
    detailLabel = 'All chapters are stored on this device for offline reading.';
    actionLabel = 'Saved on device';
    tone = 'ready';
  } else if (isBundled) {
    badgeLabels = ['Ready now', 'Included with app'];
    statusLabel = 'Included with app';
    detailLabel = 'You can read this translation right now. Save it to the device if you want every chapter cached locally.';
    actionLabel = 'Save to device';
    removeLabel = 'Remove saved copy';
    tone = 'ready';
  } else if (isPartial) {
    badgeLabels = ['Partially saved'];
    statusLabel = 'Partially saved';
    detailLabel =
      typeof meta?.completedChapters === 'number' && typeof meta?.totalChapters === 'number'
        ? `${meta.completedChapters} / ${meta.totalChapters} chapters are saved. Finish the install to cache the full translation.`
        : 'Some chapters are saved, but this translation is not fully available offline yet.';
    if (meta?.sampleError) {
      detailLabel = `${detailLabel} Last issue: ${meta.sampleError}`;
    }
    actionLabel = 'Resume';
    tone = 'progress';
  } else if (installSource === 'remote') {
    badgeLabels = ['Download required'];
    statusLabel = 'Not saved on device';
    detailLabel = 'Download this translation to read every chapter offline.';
    actionLabel = 'Download';
    tone = 'pending';
  } else {
    badgeLabels = ['Unavailable'];
    statusLabel = 'Not available in this build';
    detailLabel = 'This translation needs a licensed local bundle before it can be used offline here.';
    actionLabel = 'Unavailable';
    tone = 'unavailable';
  }

  return {
    actionLabel,
    badgeLabels,
    canInstall: canInstallTranslation(translationId),
    canReadNow,
    detailLabel,
    installSource,
    isBundled,
    isInstalling,
    isPartial,
    isSavedOnDevice,
    removeLabel,
    statusLabel,
    tone,
  };
}

export function getTranslationSelectLabel(translation, meta) {
  const status = getTranslationStatus(translation.id, meta);
  let suffix = status.statusLabel;

  if (status.isInstalling) {
    suffix = 'Installing';
  } else if (status.isBundled && !status.isSavedOnDevice) {
    suffix = 'Included with app';
  } else if (status.isSavedOnDevice) {
    suffix = 'Saved on device';
  } else if (status.isPartial) {
    suffix = 'Partially saved';
  } else if (status.installSource === 'remote') {
    suffix = 'Download required';
  } else {
    suffix = 'Not available';
  }

  return `${translation.abbreviation} - ${translation.name} - ${suffix}`;
}
