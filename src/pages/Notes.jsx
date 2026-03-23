import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Trash2, Edit3, BookOpen, Search } from 'lucide-react';
import { getAllNotes, deleteNote, saveNote } from '../utils/db';
import { getBookById } from '../utils/bibleData';
import { getSettings } from '../utils/storage';
import '../styles/notes.css';

export default function Notes() {
  const navigate = useNavigate();
  const settings = getSettings();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
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

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const bookName = getBookById(n.bookId)?.name?.toLowerCase() || '';
    const title = n.title?.toLowerCase() || '';
    const reference = n.bookId && n.chapter
      ? `${bookName} ${n.chapter}${n.verse ? `:${n.verse}` : ''}`
      : '';
    return (
      title.includes(q) ||
      (n.text || '').toLowerCase().includes(q) ||
      bookName.includes(q) ||
      reference.includes(q)
    );
  });

  return (
    <div className="page">
      <h1 className="page-title">Notes</h1>

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
        />
        <textarea
          value={newNote.text}
          onChange={(e) => setNewNote((current) => ({ ...current, text: e.target.value }))}
          placeholder="Write a note without attaching it to a verse..."
          rows={4}
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
        <div className="notes-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                    />
                    <textarea
                      value={editDraft.text}
                      onChange={(e) =>
                        setEditDraft((current) => ({ ...current, text: e.target.value }))
                      }
                      autoFocus
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
                        {ref ? (
                          <button className="note-ref" onClick={() => goToVerse(note)}>
                            <BookOpen size={14} />
                            <span>{ref}</span>
                          </button>
                        ) : (
                          <span className="chip note-chip">General note</span>
                        )}
                      </div>
                      <span className="note-date">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {note.text && <p className="note-text">{note.text}</p>}
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
