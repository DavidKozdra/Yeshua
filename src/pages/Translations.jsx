import { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Check, Globe } from 'lucide-react';
import { AVAILABLE_TRANSLATIONS } from '../utils/bibleData';
import {
  downloadTranslation,
  removeTranslation,
} from '../utils/api';
import { getAllDownloadedTranslations } from '../utils/db';
import { getTranslationStatus } from '../utils/translationStatus';
import '../styles/translations.css';

export default function Translations() {
  const [downloaded, setDownloaded] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(null);

  useEffect(() => {
    loadDownloaded();
    const intervalId = window.setInterval(loadDownloaded, 2000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadDownloaded() {
    const list = await getAllDownloadedTranslations({ includeIncomplete: true });
    setDownloaded(list);
  }

  function getDownloadMeta(id) {
    return downloaded.find((d) => d.id === id);
  }

  async function handleDownload(id) {
    if (getDownloadMeta(id)?.inProgress) return;

    setDownloading(id);
    setProgress({ done: 0, total: 1 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await downloadTranslation(
        id,
        (done, total) => setProgress({ done, total }),
        controller.signal
      );
      await loadDownloaded();
    } catch (err) {
      if (err.message !== 'Download cancelled') {
        console.error('Download error:', err);
      }
    }
    setDownloading(null);
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleRemove(id) {
    if (!confirm('Remove this translation from offline storage?')) return;
    await removeTranslation(id);
    await loadDownloaded();
  }

  return (
    <div className="page">
      <h1 className="page-title">Translations</h1>
      <p className="translations-intro">
        Ready now means you can open the translation immediately. Included with app means the text ships in this build. Saved on device means every chapter is cached in local storage.
      </p>

      <div className="translations-list">
        {AVAILABLE_TRANSLATIONS.map((t) => {
          const downloadMeta = getDownloadMeta(t.id);
          const status = getTranslationStatus(t.id, downloadMeta);
          const isActive = downloading === t.id;
          const isInProgress = isActive || status.isInstalling;
          const progressDone = isActive ? progress.done : downloadMeta?.completedChapters ?? 0;
          const progressTotal = isActive ? progress.total : downloadMeta?.totalChapters ?? 0;
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
                  <button className="btn btn-outline btn-sm" onClick={handleCancel}>
                    Cancel
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
                      disabled={!status.canInstall || !!downloading}
                    >
                      <Download size={14} />
                      {status.actionLabel}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleRemove(t.id)}
                      disabled={!!downloading}
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownload(t.id)}
                    disabled={!status.canInstall || !!downloading}
                  >
                    <Download size={14} />
                    {status.actionLabel}
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
