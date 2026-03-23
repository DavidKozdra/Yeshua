import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  StickyNote,
  ExternalLink,
  X,
  Plus,
} from 'lucide-react';
import { BIBLE_BOOKS, getBookById, getTranslationById } from '../utils/bibleData';
import { fetchChapter, resolveInstallableTranslationId } from '../utils/api';
import {
  getNotesForChapter,
  saveNote,
  deleteNote,
  getAllDownloadedTranslations,
  getChapter,
  getTranslationMeta,
} from '../utils/db';
import { getSettings, saveLastRead, getLastRead } from '../utils/storage';
import { DEFAULT_TRANSLATION_ID, FALLBACK_TRANSLATION_ID } from '../utils/translationConfig';
import '../styles/read.css';

export default function Read() {
  const params = useParams();
  const navigate = useNavigate();
  const settings = getSettings();
  const lastRead = getLastRead();
  const resolvedBook = getBookById(params.bookId || lastRead?.bookId || 'JHN') || getBookById('JHN');
  const parsedChapter = Number.parseInt(params.chapter ?? '', 10);
  const resolvedChapter = Number.isNaN(parsedChapter) ? lastRead?.chapter || 1 : parsedChapter;
  const resolvedTranslation =
    getTranslationById(params.translationId || lastRead?.translationId || settings.defaultTranslation) ||
    getTranslationById(settings.defaultTranslation) ||
    getTranslationById(DEFAULT_TRANSLATION_ID) ||
    getTranslationById(FALLBACK_TRANSLATION_ID);

  const translationId = resolvedTranslation.id;
  const bookId = resolvedBook.id;
  const chapter = Math.min(Math.max(resolvedChapter, 1), resolvedBook.chapters);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chapterNotes, setChapterNotes] = useState([]);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [offlineState, setOfflineState] = useState({
    ready: false,
    message: 'Preparing your offline Bible library...',
    progress: null,
  });
  const contentRef = useRef(null);

  const book = resolvedBook;
  const translation = resolvedTranslation;

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function syncOfflineState() {
      const downloadedTranslations = await getAllDownloadedTranslations();
      if (cancelled) return false;

      setAvailableTranslations(downloadedTranslations);

      const translationReady = downloadedTranslations.some((item) => item.id === translationId);
      const cachedChapter = await getChapter(translationId, bookId, chapter);
      if (cancelled) return false;

      if (!translationReady && downloadedTranslations.length > 0 && !cachedChapter) {
        const fallbackTranslation =
          downloadedTranslations.find((item) => item.id === settings.defaultTranslation) ||
          downloadedTranslations[0];

        if (fallbackTranslation && fallbackTranslation.id !== translationId) {
          navigate(`/read/${fallbackTranslation.id}/${bookId}/${chapter}`, { replace: true });
          return false;
        }
      }

      if (translationReady || cachedChapter) {
        setOfflineState({ ready: true, message: '', progress: null });
        return false;
      }

      const startupTranslationId = resolveInstallableTranslationId();
      const startupTranslation = startupTranslationId
        ? getTranslationById(startupTranslationId)
        : null;
      const startupMeta = startupTranslationId
        ? await getTranslationMeta(startupTranslationId)
        : null;
      if (cancelled) return false;

      setOfflineState({
        ready: false,
        message: startupMeta?.inProgress
          ? `Preparing ${startupTranslation?.abbreviation || 'your offline Bible library'}...`
          : downloadedTranslations.length === 0
            ? startupTranslation
              ? `${startupTranslation.abbreviation} is installed by default in this build.`
              : 'Download a translation to start reading offline.'
            : `${translation.abbreviation} is not downloaded yet.`,
        progress: startupMeta?.totalChapters
          ? {
              done: startupMeta.completedChapters ?? 0,
              total: startupMeta.totalChapters,
            }
          : null,
      });

      return Boolean(startupMeta?.inProgress);
    }

    async function watchOfflineState() {
      let shouldPoll = true;

      while (!cancelled && shouldPoll) {
        shouldPoll = await syncOfflineState();
        if (!shouldPoll || cancelled) break;

        await new Promise((resolve) => {
          timeoutId = window.setTimeout(resolve, 1200);
        });
      }
    }

    watchOfflineState();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    translationId,
    bookId,
    chapter,
    settings.defaultTranslation,
    navigate,
    translation.abbreviation,
  ]);

  const loadChapter = useCallback(async () => {
    if (!offlineState.ready) {
      setVerses([]);
      setChapterNotes([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchChapter(translationId, bookId, chapter, { offlineOnly: true });
      setVerses(data);
      saveLastRead({ translationId, bookId, chapter });
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
    } catch (err) {
      setVerses([]);
      setChapterNotes([]);
      setError(err.message);
    }
    setLoading(false);
  }, [offlineState.ready, translationId, bookId, chapter]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [bookId, chapter]);

  function goTo(newBook, newChapter, newTranslation = translationId) {
    navigate(`/read/${newTranslation}/${newBook}/${newChapter}`, { replace: true });
  }

  function prevChapter() {
    if (chapter > 1) {
      goTo(bookId, chapter - 1);
    } else {
      const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
      if (idx > 0) {
        const prevBook = BIBLE_BOOKS[idx - 1];
        goTo(prevBook.id, prevBook.chapters);
      }
    }
  }

  function nextChapter() {
    if (chapter < book.chapters) {
      goTo(bookId, chapter + 1);
    } else {
      const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
      if (idx < BIBLE_BOOKS.length - 1) {
        goTo(BIBLE_BOOKS[idx + 1].id, 1);
      }
    }
  }

  function versesWithNotes() {
    const noteMap = new Set();
    chapterNotes.forEach((n) => noteMap.add(n.verse));
    return noteMap;
  }

  function openNoteForVerse(verse) {
    const existing = chapterNotes.find((n) => n.verse === verse);
    if (existing) {
      setNoteText(existing.text);
      setEditingNoteId(existing.id);
    } else {
      setNoteText('');
      setEditingNoteId(null);
    }
    setSelectedVerse(verse);
    setShowNoteModal(true);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    const note = {
      ...(editingNoteId ? { id: editingNoteId } : {}),
      translationId,
      bookId,
      chapter,
      verse: selectedVerse,
      verseKey: `${bookId}:${chapter}:${selectedVerse}`,
      bookChapter: `${bookId}:${chapter}`,
      text: noteText.trim(),
      createdAt: editingNoteId
        ? chapterNotes.find((n) => n.id === editingNoteId)?.createdAt
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveNote(note);
    setShowNoteModal(false);
    const notes = await getNotesForChapter(bookId, chapter);
    setChapterNotes(notes);
  }

  async function handleDeleteNote() {
    if (editingNoteId) {
      await deleteNote(editingNoteId);
      setShowNoteModal(false);
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
    }
  }

  const noteVerses = versesWithNotes();

  return (
    <div className="read-page">
      {/* Top bar */}
      <div className="read-topbar">
        <div className="read-selectors">
          <button
            className="selector-btn"
            onClick={() => {
              setShowBookSelector(true);
              setShowChapterSelector(false);
            }}
          >
            <BookOpen size={16} />
            <span>{book?.name || bookId}</span>
          </button>
          <button
            className="selector-btn"
            onClick={() => {
              setShowChapterSelector(true);
              setShowBookSelector(false);
            }}
          >
            <List size={16} />
            <span>Ch. {chapter}</span>
          </button>
          <select
            className="translation-select"
            value={translationId}
            onChange={(e) => {
              goTo(bookId, chapter, e.target.value);
            }}
          >
            {/* Always show current translation */}
            {translation && (
              <option value={translationId}>{translation.abbreviation}</option>
            )}
            {availableTranslations
              .filter((t) => t.id !== translationId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbreviation}
                </option>
              ))}
          </select>
        </div>
        <a
          href={`https://biblehub.com/${book?.name?.toLowerCase().replace(/\s+/g, '_') || bookId}/${chapter}.htm`}
          target="_blank"
          rel="noopener noreferrer"
          className="research-link"
          title="View commentaries on Bible Hub"
        >
          <ExternalLink size={16} />
        </a>
      </div>

      {/* Book selector panel */}
      {showBookSelector && (
        <div className="selector-panel">
          <div className="selector-panel-header">
            <h3>Select Book</h3>
            <button onClick={() => setShowBookSelector(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="selector-panel-content">
            <p className="section-label">Old Testament</p>
            <div className="book-grid">
              {BIBLE_BOOKS.filter((b) => b.testament === 'OT').map((b) => (
                <button
                  key={b.id}
                  className={`book-btn ${b.id === bookId ? 'active' : ''}`}
                  onClick={() => {
                    goTo(b.id, 1);
                    setShowBookSelector(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <p className="section-label" style={{ marginTop: '1rem' }}>New Testament</p>
            <div className="book-grid">
              {BIBLE_BOOKS.filter((b) => b.testament === 'NT').map((b) => (
                <button
                  key={b.id}
                  className={`book-btn ${b.id === bookId ? 'active' : ''}`}
                  onClick={() => {
                    goTo(b.id, 1);
                    setShowBookSelector(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chapter selector panel */}
      {showChapterSelector && (
        <div className="selector-panel">
          <div className="selector-panel-header">
            <h3>{book?.name} - Select Chapter</h3>
            <button onClick={() => setShowChapterSelector(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="chapter-grid">
            {Array.from({ length: book?.chapters || 0 }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                className={`chapter-btn ${ch === chapter ? 'active' : ''}`}
                onClick={() => {
                  goTo(bookId, ch);
                  setShowChapterSelector(false);
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bible text */}
      <div className="read-content" ref={contentRef}>
        <h2 className="chapter-heading">
          {book?.name} {chapter}
        </h2>

        {loading && <div className="loading-spinner">Loading...</div>}
        {!loading && !offlineState.ready && (
          <div className="read-empty-state">
            <p>{offlineState.message}</p>
            {offlineState.progress && (
              <div className="download-progress read-progress">
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${
                        offlineState.progress.total
                          ? (offlineState.progress.done / offlineState.progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="progress-text">
                  {offlineState.progress.done} / {offlineState.progress.total} chapters saved
                </span>
              </div>
            )}
            <div className="read-empty-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/translations')}>
                Open Translations
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="read-error">
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={loadChapter}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && offlineState.ready && (
          <div
            className="verses"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
            }}
          >
            {verses.map((v) => (
              <span
                key={v.verse}
                className={`verse ${noteVerses.has(v.verse) ? 'has-note' : ''}`}
                onClick={() => openNoteForVerse(v.verse)}
              >
                {settings.showVerseNumbers && (
                  <sup className="verse-num">{v.verse}</sup>
                )}
                {v.text}{' '}
              </span>
            ))}
          </div>
        )}

        {/* Chapter navigation */}
        {offlineState.ready && !error && (
          <div className="chapter-nav">
            <button className="btn btn-outline" onClick={prevChapter}>
              <ChevronLeft size={18} />
              Previous
            </button>
            <button className="btn btn-outline" onClick={nextChapter}>
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Note modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              <StickyNote size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {book?.name} {chapter}:{selectedVerse}
            </h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              autoFocus
              style={{ width: '100%' }}
            />
            <div className="modal-actions">
              {editingNoteId && (
                <button className="btn btn-danger btn-sm" onClick={handleDeleteNote}>
                  Delete
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setShowNoteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>
                {editingNoteId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating add note button */}
      <button
        className="fab"
        onClick={() => {
          setSelectedVerse(1);
          setNoteText('');
          setEditingNoteId(null);
          setShowNoteModal(true);
        }}
        title="Add note"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
