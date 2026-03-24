import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  ExternalLink,
  Globe,
  LibraryBig,
  Trash2,
} from 'lucide-react';
import { AVAILABLE_TRANSLATIONS } from '../utils/bibleData';
import {
  BOOKS_TAB_COLLECTIONS,
  getBooksCollectionDefaultRoute,
  getBooksCollectionStats,
} from '../utils/booksData';
import {
  cancelBooksCollectionInstall,
  getBooksInstallQueueSnapshot,
  queueBooksCollectionInstall,
  removeBooksCollection,
  subscribeToBooksInstallEvents,
} from '../utils/booksApi';
import {
  cancelTranslationInstall,
  getTranslationInstallQueueSnapshot,
  queueTranslationInstall,
  removeTranslation,
  subscribeToTranslationInstallEvents,
} from '../utils/api';
import {
  getAllDownloadedLibraryCollections,
  getAllDownloadedTranslations,
} from '../utils/db';
import { getBooksCollectionStatus } from '../utils/booksStatus';
import { getTranslationStatus } from '../utils/translationStatus';
import { getLastBooksRead } from '../utils/storage';
import '../styles/books.css';
import '../styles/translations.css';

const LIBRARY_TABS = [
  { id: 'library', label: 'Library', icon: LibraryBig },
  { id: 'translations', label: 'Bible Translations', icon: BookOpen },
  { id: 'external', label: 'External Sources', icon: ExternalLink },
];

function getCollectionTarget(collectionId) {
  const lastBooksRead = getLastBooksRead();
  if (lastBooksRead?.collectionId === collectionId && lastBooksRead?.workId) {
    return `/books/${collectionId}/${lastBooksRead.workId}/${lastBooksRead.chapter || 1}`;
  }

  return getBooksCollectionDefaultRoute(collectionId);
}

export default function Translations({ preferredTab = 'translations' }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(preferredTab);
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);
  const [translationInstallState, setTranslationInstallState] = useState(() =>
    getTranslationInstallQueueSnapshot()
  );
  const [downloadedCollections, setDownloadedCollections] = useState([]);
  const [booksInstallState, setBooksInstallState] = useState(() => getBooksInstallQueueSnapshot());

  useEffect(() => {
    setActiveTab(preferredTab);
  }, [preferredTab]);

  useEffect(() => {
    let cancelled = false;

    async function loadDownloadedTranslationsState() {
      const list = await getAllDownloadedTranslations({ includeIncomplete: true });
      if (!cancelled) {
        setDownloadedTranslations(list);
      }
    }

    loadDownloadedTranslationsState();
    const unsubscribe = subscribeToTranslationInstallEvents((event) => {
      setTranslationInstallState(event.snapshot);
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloadedTranslationsState();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDownloadedCollectionsState() {
      const list = await getAllDownloadedLibraryCollections({ includeIncomplete: true });
      if (!cancelled) {
        setDownloadedCollections(list);
      }
    }

    loadDownloadedCollectionsState();
    const unsubscribe = subscribeToBooksInstallEvents((event) => {
      setBooksInstallState(event.snapshot);
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloadedCollectionsState();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function getDownloadMeta(id) {
    return downloadedTranslations.find((entry) => entry.id === id) || null;
  }

  function getCollectionMeta(id) {
    return downloadedCollections.find((entry) => entry.id === id) || null;
  }

  function getInstallActionLabel(status) {
    if (status.isQueued || status.isInstalling || !translationInstallState.activeTranslationId) {
      return status.actionLabel;
    }

    if (status.isBundled) return 'Queue save';
    if (status.isPartial) return 'Queue resume';
    return 'Queue install';
  }

  function handleTranslationDownload(id) {
    void queueTranslationInstall(id).catch((err) => {
      if (err.message !== 'Download cancelled') {
        console.error('Translation download error:', err);
      }
    });
  }

  function handleCancelTranslation(id) {
    cancelTranslationInstall(id);
  }

  async function handleRemoveTranslation(id) {
    if (!confirm('Remove this translation from offline storage?')) return;
    await removeTranslation(id);
  }

  function handleBooksDownload(collectionId) {
    void queueBooksCollectionInstall(collectionId).catch((err) => {
      if (err.message !== 'Download cancelled') {
        console.error('Books download error:', err);
      }
    });
  }

  async function handleRemoveCollection(collectionId) {
    if (!confirm('Remove this collection from offline storage?')) return;
    await removeBooksCollection(collectionId);
    const nextCollections = await getAllDownloadedLibraryCollections({ includeIncomplete: true });
    setDownloadedCollections(nextCollections);
  }

  const readerCollections = BOOKS_TAB_COLLECTIONS.filter((collection) => collection.kind === 'reader');
  const externalCollections = BOOKS_TAB_COLLECTIONS.filter(
    (collection) => collection.kind === 'external'
  );

  return (
    <div className="page books-page translations-page">
      <div className="card books-hero translations-hero">
        <div className="books-hero-copy">
          <span className="chip">
            <BookOpen size={12} />
            Scripture shelf
          </span>
          <h1 className="page-title books-title">Library & Translations</h1>
          <p className="books-intro">
            Manage Bible translations, reader canons, and linked source libraries from one place.
            Bible translations keep their own install queue. Library downloads stay separate.
          </p>
        </div>
      </div>

      <div className="translations-tabs" role="tablist" aria-label="Library sections">
        {LIBRARY_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`translations-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'translations' && (
        <>
          <p className="translations-intro">
            Ready now means you can open the translation immediately. Included with app means the
            text ships in this build. Saved on device means every chapter is cached in local
            storage. New installs can queue behind the current one instead of being blocked.
          </p>

          <div className="translations-list">
            {AVAILABLE_TRANSLATIONS.map((translation) => {
              const downloadMeta = getDownloadMeta(translation.id);
              const queueJob = translationInstallState.jobs[translation.id] || null;
              const status = getTranslationStatus(translation.id, downloadMeta, queueJob);
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
                  key={translation.id}
                  className={`card translation-card ${status.canReadNow ? 'downloaded' : ''}`}
                >
                  <div className="translation-info">
                    <div className="translation-header">
                      <h3>{translation.name}</h3>
                      <span className="chip">
                        <Globe size={12} />
                        {translation.language}
                      </span>
                    </div>
                    <p className="translation-abbr">{translation.abbreviation}</p>
                    <p className="translation-desc">{translation.description}</p>
                    <div className="translation-badges">
                      {status.badgeLabels.map((badge) => (
                        <span
                          key={badge}
                          className={`chip translation-chip translation-chip-${status.tone}`}
                        >
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
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleCancelTranslation(translation.id)}
                      >
                        Cancel
                      </button>
                    ) : status.isQueued ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleCancelTranslation(translation.id)}
                      >
                        Remove from Queue
                      </button>
                    ) : status.isInstalling ? (
                      <button type="button" className="btn btn-outline btn-sm" disabled>
                        {status.actionLabel}
                      </button>
                    ) : status.isSavedOnDevice ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveTranslation(translation.id)}
                      >
                        <Trash2 size={14} />
                        {status.removeLabel}
                      </button>
                    ) : status.isPartial ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleTranslationDownload(translation.id)}
                          disabled={!status.canInstall}
                        >
                          <Download size={14} />
                          {getInstallActionLabel(status)}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleRemoveTranslation(translation.id)}
                        >
                          <Trash2 size={14} />
                          Clear
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleTranslationDownload(translation.id)}
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
        </>
      )}

      {activeTab === 'library' && (
        <>
          <p className="translations-intro">
            Reader canons can stream online, download for offline reading, and keep their own queue
            and cache separate from Bible translations.
          </p>

          {readerCollections.map((collection) => {
            const meta = getCollectionMeta(collection.id);
            const queueJob = booksInstallState.jobs[collection.id] || null;
            const status = getBooksCollectionStatus(collection, meta, queueJob);
            const stats = getBooksCollectionStats(collection.id);
            const progressDone =
              queueJob?.phase === 'active' ? queueJob.progress.done : meta?.completedChapters ?? 0;
            const progressTotal =
              queueJob?.phase === 'active' ? queueJob.progress.total : meta?.totalChapters ?? 0;

            return (
              <section key={collection.id} className="books-section">
                <div className="books-section-header">
                  <div>
                    <p className="section-label">{collection.tradition}</p>
                    <h2>{collection.name}</h2>
                  </div>
                  <span className="chip">
                    <Globe size={12} />
                    Reader canon
                  </span>
                </div>

                <div className="card books-collection-card">
                  <div className="books-collection-copy">
                    <p className="books-section-copy">{collection.description}</p>
                    {collection.summary && (
                      <p className="books-section-summary">{collection.summary}</p>
                    )}

                    <div className="books-stat-row">
                      <span className="chip">{stats.workCount} works</span>
                      <span className="chip">{stats.totalChapters} chapters</span>
                      {collection.sourceLabel && <span className="chip">{collection.sourceLabel}</span>}
                    </div>

                    <div className={`translation-status translation-status-${status.tone}`}>
                      <span>{status.statusLabel}</span>
                    </div>
                    <p className="translation-detail">{status.detailLabel}</p>

                    {(status.isInstalling || status.isPartial) && progressTotal > 0 && (
                      <div className="download-progress books-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${(progressDone / progressTotal) * 100}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {progressDone} / {progressTotal} chapters
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="translation-actions books-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigate(getCollectionTarget(collection.id))}
                    >
                      <BookOpen size={14} />
                      Open
                    </button>

                    {queueJob?.phase === 'active' ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => cancelBooksCollectionInstall(collection.id)}
                      >
                        Cancel
                      </button>
                    ) : status.isQueued ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => cancelBooksCollectionInstall(collection.id)}
                      >
                        Remove from Queue
                      </button>
                    ) : status.isSavedOnDevice ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveCollection(collection.id)}
                      >
                        <Trash2 size={14} />
                        {status.removeLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleBooksDownload(collection.id)}
                        disabled={!status.canInstall}
                      >
                        <Download size={14} />
                        {status.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}

      {activeTab === 'external' && (
        <>
          <p className="translations-intro">
            These sources stay linked out to official or archival libraries rather than being saved
            locally in this build.
          </p>

          {externalCollections.map((collection) => (
            <section key={collection.id} className="books-section">
              <div className="books-section-header">
                <div>
                  <p className="section-label">{collection.tradition}</p>
                  <h2>{collection.name}</h2>
                </div>
                <span className="chip">
                  <ExternalLink size={12} />
                  External library
                </span>
              </div>

              <div className="card books-collection-card">
                <div className="books-collection-copy">
                  <p className="books-section-copy">{collection.description}</p>
                  {collection.summary && (
                    <p className="books-section-summary">{collection.summary}</p>
                  )}
                  {collection.sourceLabel && <span className="chip">{collection.sourceLabel}</span>}
                </div>
              </div>

              <div className="books-grid">
                {collection.works.map((work) => (
                  <a
                    key={work.id}
                    className="card book-resource-card"
                    href={work.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="book-resource-copy">
                      <strong>{work.title}</strong>
                      <span className="book-resource-ref">{work.reference}</span>
                      <p>{work.description}</p>
                    </div>
                    <span className="book-resource-link">
                      Open
                      <ArrowRight size={14} />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
