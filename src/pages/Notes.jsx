import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Trash2, Edit3, BookOpen, Search, NotebookPen, Filter } from 'lucide-react';
import { getAllNotes, deleteNote, saveNote } from '../utils/db';
import { getBookById, getTranslationById } from '../utils/bibleData';
import { getSettings } from '../utils/storage';
import '../styles/notes.css';

function formatNoteDate(value) {
  if (!value) return 'No date';

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function renderTextBlock(block, keyPrefix = 'block') {
  const trimmedBlock = block.trim();
  if (!trimmedBlock) return null;

  const lines = trimmedBlock.split('\n').map((line) => line.trimEnd());
  const bulletLines = lines.every((line) => /^[-*]\s+/.test(line));
  const numberedLines = lines.every((line) => /^\d+\.\s+/.test(line));

  if (bulletLines) {
    return (
      <ul key={keyPrefix} className="note-text-list">
        {lines.map((line, index) => (
          <li key={`${keyPrefix}-${index}`}>{line.replace(/^[-*]\s+/, '')}</li>
        ))}
      </ul>
    );
  }

  if (numberedLines) {
    return (
      <ol key={keyPrefix} className="note-text-list note-text-list-numbered">
        {lines.map((line, index) => (
          <li key={`${keyPrefix}-${index}`}>{line.replace(/^\d+\.\s+/, '')}</li>
        ))}
      </ol>
    );
  }

  return (
    <p key={keyPrefix} className="note-text-paragraph">
      {lines.map((line, index) => (
        <span key={`${keyPrefix}-${index}`}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

function renderNoteText(text) {
  const blocks = (text || '')
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) return null;
  return blocks.map((block, index) => renderTextBlock(block, `note-block-${index}`));
}

export default function Notes() {
  const navigate = useNavigate();
  const settings = getSettings();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingNote, setEditingNote] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', text: '' });
  const [newNote, setNewNote] = useState({ title: '', text: '' });

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const all = await getAllNotes();
    // Sort newest first
    all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setNotes(all);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this note?')) return;
    await deleteNote(id);
    await loadNotes();
  }

  async function handleSaveEdit() {
    if (!editingNote || (!editDraft.title.trim() && !editDraft.text.trim())) return;
    await saveNote({
      ...editingNote,
      title: editDraft.title.trim(),
      text: editDraft.text.trim(),
      updatedAt: new Date().toISOString(),
    });
    setEditingNote(null);
    setEditDraft({ title: '', text: '' });
    await loadNotes();
  }

  async function handleCreateNote() {
    if (!newNote.title.trim() && !newNote.text.trim()) return;

    const now = new Date().toISOString();
    await saveNote({
      title: newNote.title.trim(),
      text: newNote.text.trim(),
      createdAt: now,
      updatedAt: now,
    });

    setNewNote({ title: '', text: '' });
    await loadNotes();
  }

  function goToVerse(note) {
    if (!note.bookId || !note.chapter) return;
    navigate(
      `/read/${note.translationId || settings.defaultTranslation}/${note.bookId}/${note.chapter}`
    );
  }

  function getReference(note) {
    if (!note.bookId || !note.chapter) return null;
    const book = getBookById(note.bookId);
    return `${book?.name || note.bookId} ${note.chapter}${note.verse ? `:${note.verse}` : ''}`;
  }

  const noteStats = useMemo(() => {
    const linkedCount = notes.filter((note) => note.bookId && note.chapter).length;
    return {
      total: notes.length,
      linked: linkedCount,
      general: notes.length - linkedCount,
    };
  }, [notes]);

  const filtered = notes.filter((n) => {
    const isLinked = Boolean(n.bookId && n.chapter);
    if (filter === 'linked' && !isLinked) return false;
    if (filter === 'general' && isLinked) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const bookName = getBookById(n.bookId)?.name?.toLowerCase() || '';
    const title = n.title?.toLowerCase() || '';
    const translationName = getTranslationById(n.translationId)?.name?.toLowerCase() || '';
    const reference = n.bookId && n.chapter
      ? `${bookName} ${n.chapter}${n.verse ? `:${n.verse}` : ''}`
      : '';
    return (
      title.includes(q) ||
      (n.text || '').toLowerCase().includes(q) ||
      bookName.includes(q) ||
      reference.includes(q) ||
      translationName.includes(q)
    );
  });

  return (
    <div className="page notes-page">
      <h1 className="page-title">Notes</h1>

      <div className="notes-overview card">
        <div className="notes-overview-copy">
          <div className="notes-overview-topline">
            <NotebookPen size={18} />
            <span>Your study notes</span>
          </div>
          <p>
            Keep general reflections here and review verse-linked notes from the reader in one
            place.
          </p>
        </div>
        <div className="notes-stats" aria-label="Notes summary">
          <div className="notes-stat">
            <strong>{noteStats.total}</strong>
            <span>Total</span>
          </div>
          <div className="notes-stat">
            <strong>{noteStats.linked}</strong>
            <span>Scripture-linked</span>
          </div>
          <div className="notes-stat">
            <strong>{noteStats.general}</strong>
            <span>General</span>
          </div>
        </div>
      </div>

      <div className="card note-compose">
        <div className="note-compose-header">
          <StickyNote size={18} />
          <span>New Note</span>
        </div>
        <input
          type="text"
          value={newNote.title}
          onChange={(e) => setNewNote((current) => ({ ...current, title: e.target.value }))}
          placeholder="Title (optional)"
          aria-label="New note title"
        />
        <textarea
          value={newNote.text}
          onChange={(e) => setNewNote((current) => ({ ...current, text: e.target.value }))}
          placeholder="Write a note without attaching it to a verse..."
          rows={4}
          aria-label="New note text"
        />
        <div className="note-compose-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreateNote}
            disabled={!newNote.title.trim() && !newNote.text.trim()}
          >
            Save Note
          </button>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="notes-toolbar">
          <div className="notes-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search notes, references, or translations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search notes"
            />
          </div>
          <div className="notes-filters" role="group" aria-label="Filter notes">
            <span className="notes-filter-label">
              <Filter size={14} />
              View
            </span>
            <button
              type="button"
              className={`notes-filter-chip ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`notes-filter-chip ${filter === 'linked' ? 'active' : ''}`}
              onClick={() => setFilter('linked')}
            >
              Scripture-linked
            </button>
            <button
              type="button"
              className={`notes-filter-chip ${filter === 'general' ? 'active' : ''}`}
              onClick={() => setFilter('general')}
            >
              General
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="empty-state">
          <StickyNote size={48} strokeWidth={1} />
          <h3>No notes yet</h3>
          <p>Add a note here or tap any verse while reading.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No notes match your search.</p>
        </div>
      ) : (
        <div className="notes-list">
          {filtered.map((note) => {
            const ref = getReference(note);

            return (
              <div key={note.id} className="card note-card">
                {editingNote?.id === note.id ? (
                  <div className="note-edit">
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft((current) => ({ ...current, title: e.target.value }))
                      }
                      placeholder="Title (optional)"
                      aria-label="Edit note title"
                    />
                    <textarea
                      value={editDraft.text}
                      onChange={(e) =>
                        setEditDraft((current) => ({ ...current, text: e.target.value }))
                      }
                      autoFocus
                      aria-label="Edit note text"
                    />
                    <div className="note-edit-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setEditingNote(null);
                          setEditDraft({ title: '', text: '' });
                        }}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-header">
                      <div className="note-meta">
                        <strong className="note-title">{note.title || ref || 'Untitled note'}</strong>
                        <div className="note-meta-row">
                          {ref ? (
                            <button className="note-ref" onClick={() => goToVerse(note)}>
                              <BookOpen size={14} />
                              <span>{ref}</span>
                            </button>
                          ) : (
                            <span className="chip note-chip">General note</span>
                          )}
                          {note.translationId && (
                            <span className="chip note-chip note-chip-secondary">
                              {getTranslationById(note.translationId)?.abbreviation ||
                                note.translationId.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="note-date-group">
                        <span className="note-date">Updated {formatNoteDate(note.updatedAt)}</span>
                        {note.createdAt && note.createdAt !== note.updatedAt && (
                          <span className="note-date note-date-secondary">
                            Created {formatNoteDate(note.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    {note.text && <div className="note-text">{renderNoteText(note.text)}</div>}
                    <div className="note-actions">
                      <button
                        className="note-action-btn"
                        onClick={() => {
                          setEditingNote(note);
                          setEditDraft({ title: note.title || '', text: note.text || '' });
                        }}
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <button
                        className="note-action-btn danger"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
