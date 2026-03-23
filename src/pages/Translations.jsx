import { useState, useEffect } from 'react';
import { Download, Trash2, Check, Globe } from 'lucide-react';
import { AVAILABLE_TRANSLATIONS } from '../utils/bibleData';
import {
  cancelTranslationInstall,
  getTranslationInstallQueueSnapshot,
  queueTranslationInstall,
  removeTranslation,
  subscribeToTranslationInstallEvents,
} from '../utils/api';
import { getAllDownloadedTranslations } from '../utils/db';
import { getTranslationStatus } from '../utils/translationStatus';
import '../styles/translations.css';

export default function Translations() {
  const [downloaded, setDownloaded] = useState([]);
  const [installState, setInstallState] = useState(() => getTranslationInstallQueueSnapshot());

  useEffect(() => {
    let cancelled = false;

    async function loadDownloaded() {
      const list = await getAllDownloadedTranslations({ includeIncomplete: true });
      if (!cancelled) {
        setDownloaded(list);
      }
    }

    loadDownloaded();
    const unsubscribe = subscribeToTranslationInstallEvents((event) => {
      setInstallState(event.snapshot);
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloaded();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function getDownloadMeta(id) {
    return downloaded.find((d) => d.id === id);
  }

  function getInstallActionLabel(status) {
    if (status.isQueued || status.isInstalling || !installState.activeTranslationId) {
      return status.actionLabel;
    }

    if (status.isBundled) return 'Queue save';
    if (status.isPartial) return 'Queue resume';
    return 'Queue install';
  }

  function handleDownload(id) {
    void queueTranslationInstall(id).catch((err) => {
      if (err.message !== 'Download cancelled') {
        console.error('Download error:', err);
      }
    });
  }

  function handleCancel(id) {
    cancelTranslationInstall(id);
  }

  async function handleRemove(id) {
    if (!confirm('Remove this translation from offline storage?')) return;
    await removeTranslation(id);
  }

  return (
    <div className="page">
      <h1 className="page-title">Translations</h1>
      <p className="translations-intro">
        Ready now means you can open the translation immediately. Included with app means the text ships in this build. Saved on device means every chapter is cached in local storage. New installs can queue behind the current one instead of being blocked.
      </p>

      <div className="translations-list">
        {AVAILABLE_TRANSLATIONS.map((t) => {
          const downloadMeta = getDownloadMeta(t.id);
          const queueJob = installState.jobs[t.id] || null;
          const status = getTranslationStatus(t.id, downloadMeta, queueJob);
          const isActive = queueJob?.phase === 'active';
          const isInProgress = isActive || status.isInstalling;
          const progressDone = isActive
            ? queueJob.progress.done
            : downloadMeta?.completedChapters ?? 0;
          const progressTotal = isActive
            ? queueJob.progress.total
            : downloadMeta?.totalChapters ?? 0;
          const StatusIcon =
            status.tone === 'ready' ? Check : status.tone === 'progress' ? Download : Globe;

          return (
            <div
              key={t.id}
              className={`card translation-card ${status.canReadNow ? 'downloaded' : ''}`}
            >
              <div className="translation-info">
                <div className="translation-header">
                  <h3>{t.name}</h3>
                  <span className="chip">
                    <Globe size={12} />
                    {t.language}
                  </span>
                </div>
                <p className="translation-abbr">{t.abbreviation}</p>
                <p className="translation-desc">{t.description}</p>
                <div className="translation-badges">
                  {status.badgeLabels.map((badge) => (
                    <span key={badge} className={`chip translation-chip translation-chip-${status.tone}`}>
                      {badge}
                    </span>
                  ))}
                </div>

                {!isInProgress && (
                  <div className={`translation-status translation-status-${status.tone}`}>
                    <StatusIcon size={14} />
                    <span>{status.statusLabel}</span>
                  </div>
                )}
                <p className="translation-detail">{status.detailLabel}</p>

                {isInProgress && (
                  <div className="download-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${progressTotal ? (progressDone / progressTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="progress-text">
                      {progressDone} / {progressTotal} chapters
                    </span>
                  </div>
                )}
              </div>

              <div className="translation-actions">
                {isActive ? (
                  <button className="btn btn-outline btn-sm" onClick={() => handleCancel(t.id)}>
                    Cancel
                  </button>
                ) : status.isQueued ? (
                  <button className="btn btn-outline btn-sm" onClick={() => handleCancel(t.id)}>
                    Remove from Queue
                  </button>
                ) : status.isInstalling ? (
                  <button className="btn btn-outline btn-sm" disabled>
                    {status.actionLabel}
                  </button>
                ) : status.isSavedOnDevice ? (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemove(t.id)}>
                    <Trash2 size={14} />
                    {status.removeLabel}
                  </button>
                ) : status.isPartial ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleDownload(t.id)}
                      disabled={!status.canInstall}
                    >
                      <Download size={14} />
                      {getInstallActionLabel(status)}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleRemove(t.id)}
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownload(t.id)}
                    disabled={!status.canInstall}
                  >
                    <Download size={14} />
                    {getInstallActionLabel(status)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
