import { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Check, Globe } from 'lucide-react';
import { AVAILABLE_TRANSLATIONS } from '../utils/bibleData';
import {
  canInstallTranslation,
  downloadTranslation,
  getTranslationInstallSource,
  removeTranslation,
} from '../utils/api';
import { getAllDownloadedTranslations } from '../utils/db';
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
        Download Bible translations for offline reading. Once downloaded, you can read without an internet connection.
      </p>

      <div className="translations-list">
        {AVAILABLE_TRANSLATIONS.map((t) => {
          const downloadMeta = getDownloadMeta(t.id);
          const installSource = getTranslationInstallSource(t.id);
          const isInstallable = canInstallTranslation(t.id);
          const isActive = downloading === t.id;
          const isComplete = downloadMeta?.isComplete === true;
          const isPartial = !!downloadMeta && !isComplete;
          const actionLabel = installSource === 'bundle' ? 'Install' : 'Download';
          const progressLabel =
            typeof downloadMeta?.completedChapters === 'number' &&
            typeof downloadMeta?.totalChapters === 'number'
              ? `${downloadMeta.completedChapters} / ${downloadMeta.totalChapters} chapters saved`
              : 'Stored locally, but not ready for offline reading';

          return (
            <div
              key={t.id}
              className={`card translation-card ${isComplete ? 'downloaded' : ''}`}
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

                {isComplete && !isActive && (
                  <div className="translation-status">
                    <Check size={14} />
                    <span>Available offline</span>
                  </div>
                )}

                {isPartial && !isActive && (
                  <div className="translation-status incomplete">
                    <Download size={14} />
                    <span>{progressLabel}</span>
                  </div>
                )}

                {!isInstallable && !isComplete && !isPartial && !isActive && (
                  <div className="translation-status incomplete">
                    <Download size={14} />
                    <span>Requires a licensed local bundle in this build.</span>
                  </div>
                )}

                {isActive && (
                  <div className="download-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="progress-text">
                      {progress.done} / {progress.total} chapters
                    </span>
                  </div>
                )}
              </div>

              <div className="translation-actions">
                {isActive ? (
                  <button className="btn btn-outline btn-sm" onClick={handleCancel}>
                    Cancel
                  </button>
                ) : isComplete ? (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemove(t.id)}>
                    <Trash2 size={14} />
                    Remove
                  </button>
                ) : isPartial ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleDownload(t.id)}
                      disabled={!isInstallable || !!downloading}
                    >
                      <Download size={14} />
                      Resume
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
                    disabled={!isInstallable || !!downloading}
                  >
                    <Download size={14} />
                    {isPartial ? 'Resume' : actionLabel}
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
