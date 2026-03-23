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
import { fetchChapter } from '../utils/api';
import { getNotesForChapter, saveNote, deleteNote } from '../utils/db';
import { getSettings, saveLastRead, getLastRead } from '../utils/storage';
import { getAllDownloadedTranslations } from '../utils/db';
import '../styles/read.css';

export default function Read() {
  const params = useParams();
  const navigate = useNavigate();
  const settings = getSettings();

  const resolvedTranslation = params.translationId || settings.defaultTranslation;
  const resolvedBook = params.bookId || getLastRead()?.bookId || 'JHN';
  const resolvedChapter = parseInt(params.chapter) || getLastRead()?.chapter || 1;

  const [translationId, setTranslationId] = useState(resolvedTranslation);
  const [bookId, setBookId] = useState(resolvedBook);
  const [chapter, setChapter] = useState(resolvedChapter);
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
  const contentRef = useRef(null);

  const book = getBookById(bookId);
  const translation = getTranslationById(translationId);

  useEffect(() => {
    getAllDownloadedTranslations().then(setAvailableTranslations);
  }, []);

  const loadChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChapter(translationId, bookId, chapter);
      setVerses(data);
      saveLastRead({ translationId, bookId, chapter });
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [translationId, bookId, chapter]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [bookId, chapter]);

  function goTo(newBook, newChapter) {
    setBookId(newBook);
    setChapter(newChapter);
    navigate(`/read/${translationId}/${newBook}/${newChapter}`, { replace: true });
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
              setTranslationId(e.target.value);
              navigate(`/read/${e.target.value}/${bookId}/${chapter}`, { replace: true });
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
        {error && (
          <div className="read-error">
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={loadChapter}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
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
