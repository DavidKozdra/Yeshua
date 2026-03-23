import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Download, ExternalLink, Globe, Trash2 } from 'lucide-react';
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
import { getBooksCollectionStatus } from '../utils/booksStatus';
import {
  getAllDownloadedLibraryCollections,
  getAllDownloadedTranslations,
} from '../utils/db';
import {
  getLastBooksRead,
  getLastRead,
  getSettings,
  subscribeToSettings,
} from '../utils/storage';
import '../styles/books.css';
import '../styles/translations.css';

function getBibleTarget(settings) {
  const lastRead = getLastRead();
  return {
    translationId: lastRead?.translationId || settings.defaultTranslation,
    bookId: lastRead?.bookId || 'JHN',
    chapter: lastRead?.chapter || 1,
  };
}

function getCollectionTarget(collectionId) {
  const lastBooksRead = getLastBooksRead();
  if (lastBooksRead?.collectionId === collectionId && lastBooksRead?.workId) {
    return `/books/${collectionId}/${lastBooksRead.workId}/${lastBooksRead.chapter || 1}`;
  }

  return getBooksCollectionDefaultRoute(collectionId);
}

export default function Books() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getSettings);
  const [downloadedCollections, setDownloadedCollections] = useState([]);
  const [installState, setInstallState] = useState(() => getBooksInstallQueueSnapshot());
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);

  useEffect(() => subscribeToSettings(setSettings), []);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      const [collections, translations] = await Promise.all([
        getAllDownloadedLibraryCollections({ includeIncomplete: true }),
        getAllDownloadedTranslations({ includeIncomplete: true }),
      ]);

      if (cancelled) return;
      setDownloadedCollections(collections);
      setDownloadedTranslations(translations);
    }

    loadState();
    const unsubscribe = subscribeToBooksInstallEvents((event) => {
      setInstallState(event.snapshot);
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadState();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function openBibleReader() {
    const target = getBibleTarget(settings);
    navigate(`/read/${target.translationId}/${target.bookId}/${target.chapter}`);
  }

  function getCollectionMeta(collectionId) {
    return downloadedCollections.find((item) => item.id === collectionId) || null;
  }

  function handleDownload(collectionId) {
    void queueBooksCollectionInstall(collectionId).catch((error) => {
      if (error.message !== 'Download cancelled') {
        console.error('Books download error:', error);
      }
    });
  }

  async function handleRemove(collectionId) {
    if (!confirm('Remove this collection from offline storage?')) return;
    await removeBooksCollection(collectionId);
    const nextCollections = await getAllDownloadedLibraryCollections({ includeIncomplete: true });
    setDownloadedCollections(nextCollections);
  }

  return (
    <div className="page books-page">
      <div className="card books-hero">
        <div className="books-hero-copy">
          <span className="chip">
            <BookOpen size={12} />
            Canon library
          </span>
          <h1 className="page-title books-title">Books</h1>
          <p className="books-intro">
            The Books tab now behaves like its own library. Reader collections can stream online,
            download their full canon for offline use, and keep separate install state from Bible
            translations.
          </p>
        </div>
      </div>

      {!settings.showBooksTab && (
        <div className="card books-note-card">
          <p>
            The Books tab is hidden from navigation right now. Turn on <strong>Show Books Tab</strong>{' '}
            in Settings to keep it visible.
          </p>
        </div>
      )}

      {BOOKS_TAB_COLLECTIONS.map((collection) => {
        const meta = getCollectionMeta(collection.id);
        const queueJob = installState.jobs[collection.id] || null;
        const status = getBooksCollectionStatus(collection, meta, queueJob);
        const stats = getBooksCollectionStats(collection.id);
        const progressDone =
          queueJob?.phase === 'active' ? queueJob.progress.done : meta?.completedChapters ?? 0;
        const progressTotal =
          queueJob?.phase === 'active' ? queueJob.progress.total : meta?.totalChapters ?? 0;
        const bibleReady = downloadedTranslations.length > 0;

        return (
          <section key={collection.id} className="books-section">
            <div className="books-section-header">
              <div>
                <p className="section-label">{collection.tradition}</p>
                <h2>{collection.name}</h2>
              </div>
              <span className="chip">
                <Globe size={12} />
                {collection.kind === 'reader'
                  ? 'Reader canon'
                  : collection.kind === 'external'
                    ? 'Linked library'
                    : 'Primary reader'}
              </span>
            </div>

            <div className="card books-collection-card">
              <div className="books-collection-copy">
                <p className="books-section-copy">{collection.description}</p>
                {collection.summary && <p className="books-section-summary">{collection.summary}</p>}

                <div className="books-stat-row">
                  {collection.kind === 'reader' && (
                    <>
                      <span className="chip">{stats.workCount} works</span>
                      <span className="chip">{stats.totalChapters} chapters</span>
                    </>
                  )}
                  {collection.kind === 'bible' && (
                    <span className="chip">
                      {bibleReady ? 'Bible translations ready' : 'Uses translation installs'}
                    </span>
                  )}
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
                {collection.kind === 'bible' ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={openBibleReader}>
                    <BookOpen size={14} />
                    Open
                  </button>
                ) : collection.kind === 'reader' ? (
                  <>
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
                        onClick={() => handleRemove(collection.id)}
                      >
                        <Trash2 size={14} />
                        {status.removeLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDownload(collection.id)}
                        disabled={!status.canInstall}
                      >
                        <Download size={14} />
                        {status.actionLabel}
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {collection.kind === 'external' && (
              <div className="books-grid">
                {collection.works.map((work) => (
                  <a
                    key={work.id}
                    href={work.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card card-clickable book-resource-card"
                  >
                    <div className="book-resource-copy">
                      <strong>{work.title}</strong>
                      <p className="book-resource-ref">{work.reference}</p>
                      <p>{work.description}</p>
                    </div>
                    <span className="book-resource-link">
                      Open source
                      <ExternalLink size={16} />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
