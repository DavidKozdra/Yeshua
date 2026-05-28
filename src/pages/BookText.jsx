import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import {
  getBooksCollectionById,
  getBooksCollectionDefaultRoute,
  getBooksWorkById,
  READER_COLLECTIONS,
} from '../utils/booksData';
import {
  cancelBooksCollectionInstall,
  fetchBooksChapter,
  getBooksInstallQueueSnapshot,
  queueBooksCollectionInstall,
  removeBooksCollection,
  resolveBooksCollectionWorks,
  subscribeToBooksInstallEvents,
} from '../utils/booksApi';
import { getBooksCollectionStatus } from '../utils/booksStatus';
import {
  deleteBookmark,
  getBookmarks,
  getLibraryCollectionMeta,
  saveBookmark,
  saveReadingProgress,
} from '../utils/db';
import { getSettings, saveLastBooksRead, subscribeToSettings } from '../utils/storage';
import '../styles/books.css';
import '../styles/read.css';

function getNeighborWork(works, currentIndex, direction) {
  if (direction === 'previous' && currentIndex > 0) {
    return works[currentIndex - 1];
  }

  if (direction === 'next' && currentIndex < works.length - 1) {
    return works[currentIndex + 1];
  }

  return null;
}

export default function BookText() {
  const navigate = useNavigate();
  const params = useParams();
  const [settings, setSettings] = useState(getSettings);
  const [installState, setInstallState] = useState(() => getBooksInstallQueueSnapshot());
  const [collectionMeta, setCollectionMeta] = useState(null);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(true);
  const [worksError, setWorksError] = useState('');
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chapterBookmark, setChapterBookmark] = useState(null);

  useEffect(() => subscribeToSettings(setSettings), []);

  const collection = getBooksCollectionById(params.collectionId);

  useEffect(() => {
    let cancelled = false;

    async function loadCollectionMeta() {
      if (!params.collectionId) return;
      const meta = await getLibraryCollectionMeta(params.collectionId);
      if (!cancelled) {
        setCollectionMeta(meta);
      }
    }

    loadCollectionMeta();
    const unsubscribe = subscribeToBooksInstallEvents((event) => {
      setInstallState(event.snapshot);
      if (event.type !== 'progress' || event.collectionId === params.collectionId) {
        loadCollectionMeta();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [params.collectionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorks() {
      if (!collection || collection.kind !== 'reader') {
        setWorks([]);
        setWorksLoading(false);
        setWorksError('');
        return;
      }

      setWorksLoading(true);
      setWorksError('');

      try {
        const resolvedWorks = await resolveBooksCollectionWorks(collection.id);
        if (!cancelled) {
          setWorks(resolvedWorks);
        }
      } catch (loadError) {
        if (!cancelled) {
          setWorks([]);
          setWorksError(loadError.message || 'Unable to load this canon.');
        }
      } finally {
        if (!cancelled) {
          setWorksLoading(false);
        }
      }
    }

    loadWorks();

    return () => {
      cancelled = true;
    };
  }, [collection]);

  const work =
    getBooksWorkById(collection?.id, params.workId || '', works) ||
    getBooksWorkById(collection?.id, collection?.defaultWorkId || '', works) ||
    works[0] ||
    null;
  const parsedChapter = Number.parseInt(params.chapter ?? '', 10);
  const chapter = Math.min(
    Math.max(Number.isNaN(parsedChapter) ? 1 : parsedChapter, 1),
    work?.chapters || 1
  );
  const workIndex = works.findIndex((entry) => entry.id === work?.id);
  const previousWork = getNeighborWork(works, workIndex, 'previous');
  const nextWork = getNeighborWork(works, workIndex, 'next');
  const queueJob = collection ? installState.jobs[collection.id] || null : null;
  const status = collection ? getBooksCollectionStatus(collection, collectionMeta, queueJob) : null;
  const isStacked = settings.oneVersePerLine;

  useEffect(() => {
    if (!collection || collection.kind !== 'reader' || worksLoading || !work) return;

    const desiredPath = `/books/${collection.id}/${work.id}/${chapter}`;
    if (params.workId !== work.id || String(params.chapter || '1') !== String(chapter)) {
      navigate(desiredPath, { replace: true });
    }
  }, [chapter, collection, navigate, params.chapter, params.workId, work, worksLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadChapter() {
      if (!collection || collection.kind !== 'reader' || !work) {
        setVerses([]);
        setLoading(false);
        setError(collection?.kind === 'external' ? 'This collection opens as source links only.' : '');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const chapterVerses = await fetchBooksChapter(collection.id, work.id, chapter);
        if (cancelled) return;
        setVerses(chapterVerses);
        saveLastBooksRead({
          collectionId: collection.id,
          workId: work.id,
          chapter,
        });
        await saveReadingProgress({
          sourceType: 'library',
          collectionId: collection.id,
          workId: work.id,
          chapter,
          completedAt: new Date().toISOString(),
        });
      } catch (loadError) {
        if (cancelled) return;
        setVerses([]);
        setError(loadError.message || 'Unable to load this text.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadChapter();

    return () => {
      cancelled = true;
    };
  }, [chapter, collection, work]);

  useEffect(() => {
    let cancelled = false;

    async function loadBookmarkState() {
      setChapterBookmark(null);
      if (!collection || !work) return;
      const savedBookmarks = await getBookmarks({
        sourceType: 'library',
        collectionId: collection.id,
      });
      if (!cancelled) {
        setChapterBookmark(
          savedBookmarks.find(
            (bookmark) =>
              bookmark.workId === work.id && Number(bookmark.chapter) === Number(chapter)
          ) || null
        );
      }
    }

    loadBookmarkState();
    return () => {
      cancelled = true;
    };
  }, [chapter, collection, work]);

  const readerSubtitle = useMemo(() => {
    if (!work) return '';
    const referenceBase = [work.subtitle, work.reference].filter(Boolean).join(' • ');
    if ((work.chapters || 1) <= 1) {
      return referenceBase;
    }
    return `${referenceBase} ${chapter}`.trim();
  }, [chapter, work]);

  if (!collection) {
    return (
      <div className="page books-page">
        <div className="empty-state">
          <h1 className="page-title">Collection Not Available</h1>
          <p>The requested collection could not be found.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/books')}>
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (collection.kind !== 'reader') {
    return (
      <div className="page books-page">
        <div className="empty-state">
          <h1 className="page-title">{collection.name}</h1>
          <p>This collection opens as source links from the Library tab rather than in the in-app reader.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/books')}>
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  function navigateToWork(collectionId, workId, nextChapter = 1) {
    navigate(`/books/${collectionId}/${workId}/${nextChapter}`);
  }

  async function handleRemoveSavedCopy() {
    if (!confirm('Remove this collection from offline storage?')) return;
    await removeBooksCollection(collection.id);
    setCollectionMeta(null);
  }

  function goPrevious() {
    if (chapter > 1) {
      navigateToWork(collection.id, work.id, chapter - 1);
      return;
    }

    if (previousWork) {
      navigateToWork(collection.id, previousWork.id, previousWork.chapters || 1);
      return;
    }

    navigate('/books');
  }

  function goNext() {
    if (chapter < (work?.chapters || 1)) {
      navigateToWork(collection.id, work.id, chapter + 1);
      return;
    }

    if (nextWork) {
      navigateToWork(collection.id, nextWork.id, 1);
      return;
    }

    navigate(getBooksCollectionDefaultRoute(collection.id, works));
  }

  async function handleBookmarkChapter() {
    if (!collection || !work) return;

    if (chapterBookmark) {
      await deleteBookmark(chapterBookmark.id);
      setChapterBookmark(null);
      return;
    }

    const bookmarkId = await saveBookmark({
      sourceType: 'library',
      collectionId: collection.id,
      workId: work.id,
      chapter,
      label: `${work.title} ${chapter}`,
    });
    const savedBookmarks = await getBookmarks({
      sourceType: 'library',
      collectionId: collection.id,
    });
    setChapterBookmark(savedBookmarks.find((bookmark) => bookmark.id === bookmarkId) || null);
  }

  return (
    <div className="page book-reader-page">
      <div className="book-reader-toolbar">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/books')}>
          Back to Library
        </button>

        <div className="book-reader-picker-group">
          <select
            aria-label="Collection"
            value={collection.id}
            onChange={(event) => navigate(getBooksCollectionDefaultRoute(event.target.value))}
          >
            {READER_COLLECTIONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Work"
            value={work?.id || ''}
            onChange={(event) => navigateToWork(collection.id, event.target.value, 1)}
            disabled={worksLoading || works.length === 0}
          >
            {works.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>

          {(work?.chapters || 1) > 1 && (
            <select
              aria-label="Chapter"
              value={chapter}
              onChange={(event) =>
                navigateToWork(collection.id, work.id, Number.parseInt(event.target.value, 10))
              }
            >
              {Array.from({ length: work.chapters }, (_, index) => index + 1).map((entry) => (
                <option key={entry} value={entry}>
                  Chapter {entry}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card book-reader-shell">
        <div className="book-reader-header">
          <div>
            <p className="section-label">{collection.tradition}</p>
            <h1 className="page-title book-reader-title">{work?.title || collection.name}</h1>
            {readerSubtitle && <p className="book-reader-subtitle">{readerSubtitle}</p>}
          </div>
          {status && (
            <div className="book-reader-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => navigate('/books')}
              >
                Browse canon
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleBookmarkChapter}
                aria-pressed={Boolean(chapterBookmark)}
              >
                <Bookmark size={14} aria-hidden="true" />
                {chapterBookmark ? 'Remove bookmark' : 'Bookmark'}
              </button>
              {queueJob?.phase === 'active' ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => cancelBooksCollectionInstall(collection.id)}
                >
                  Cancel
                </button>
              ) : status.isSavedOnDevice ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleRemoveSavedCopy}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove saved copy
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    void queueBooksCollectionInstall(collection.id).catch((installError) => {
                      if (installError.message !== 'Download cancelled') {
                        console.error('Books download error:', installError);
                      }
                    });
                  }}
                  disabled={!status.canInstall || status.isQueued}
                >
                  <Download size={14} aria-hidden="true" />
                  {status.isQueued ? 'Queued' : status.actionLabel}
                </button>
              )}
            </div>
          )}
        </div>

        <p className="book-reader-description">
          {work?.description || collection.description}
        </p>

        {chapterBookmark && (
          <section className="chapter-bookmarks chapter-bookmarks-library" aria-label="Bookmarked chapter">
            <div className="chapter-bookmarks-header">
              <Bookmark size={15} aria-hidden="true" />
              <span>Bookmarked chapter</span>
            </div>
            <div className="chapter-bookmarks-list">
              <span className="chapter-bookmark-chip" aria-current="true">
                {work?.title} {chapter}
              </span>
              <button
                type="button"
                className="chapter-bookmark-remove"
                onClick={handleBookmarkChapter}
              >
                Remove
              </button>
            </div>
          </section>
        )}

        {status && (
          <div className={`book-reader-banner book-reader-banner-${status.tone}`}>
            <div>
              <strong>{status.statusLabel}</strong>
              <p>{status.detailLabel}</p>
            </div>
            {(status.isInstalling || status.isPartial) && (queueJob?.progress.total || collectionMeta?.totalChapters) ? (
              <div className="book-reader-banner-progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={queueJob?.phase === 'active' ? queueJob.progress.done : collectionMeta?.completedChapters ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={queueJob?.phase === 'active' ? queueJob.progress.total : collectionMeta?.totalChapters ?? 1}
                  aria-label={`${collection.name} download progress`}
                >
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${(
                        ((queueJob?.phase === 'active'
                          ? queueJob.progress.done
                          : collectionMeta?.completedChapters ?? 0) /
                          (queueJob?.phase === 'active'
                            ? queueJob.progress.total
                            : collectionMeta?.totalChapters ?? 1)) *
                        100
                      )}%`,
                    }}
                  />
                </div>
                <span className="progress-text">
                  {queueJob?.phase === 'active'
                    ? queueJob.progress.done
                    : collectionMeta?.completedChapters ?? 0}{' '}
                  /{' '}
                  {queueJob?.phase === 'active'
                    ? queueJob.progress.total
                    : collectionMeta?.totalChapters ?? 0}{' '}
                  chapters
                </span>
              </div>
            ) : null}
          </div>
        )}

        {worksError && !works.length ? (
          <div className="read-error" role="alert">
            <p>{worksError}</p>
          </div>
        ) : loading || worksLoading ? (
          <div className="loading-spinner" role="status" aria-live="polite">Loading text...</div>
        ) : error ? (
          <div className="read-error" role="alert">
            <p>{error}</p>
          </div>
        ) : (
          <div
            className={isStacked ? 'verses verses-stacked' : 'verses'}
            style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
          >
            {verses.map((verse) => (
              <p key={verse.verse} className="verse book-reader-verse">
                {settings.showVerseNumbers && <sup className="verse-num">{verse.verse}</sup>}
                {verse.text}
              </p>
            ))}
          </div>
        )}

        <nav className="chapter-nav" aria-label="Chapter navigation">
          <button type="button" className="btn btn-outline" onClick={goPrevious}>
            <ChevronLeft size={16} aria-hidden="true" />
            {chapter > 1
              ? `Chapter ${chapter - 1}`
              : previousWork
                ? previousWork.title
                : 'Library'}
          </button>

          <button type="button" className="btn btn-outline" onClick={goNext}>
            {chapter < (work?.chapters || 1)
              ? `Chapter ${chapter + 1}`
              : nextWork
                ? nextWork.title
                : 'Start over'}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
