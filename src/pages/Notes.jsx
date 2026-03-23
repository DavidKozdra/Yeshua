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
  const [editText, setEditText] = useState('');

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
    if (!editingNote || !editText.trim()) return;
    await saveNote({
      ...editingNote,
      text: editText.trim(),
      updatedAt: new Date().toISOString(),
    });
    setEditingNote(null);
    await loadNotes();
  }

  function goToVerse(note) {
    navigate(`/read/${settings.defaultTranslation}/${note.bookId}/${note.chapter}`);
  }

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const bookName = getBookById(n.bookId)?.name?.toLowerCase() || '';
    return (
      n.text.toLowerCase().includes(q) ||
      bookName.includes(q) ||
      `${bookName} ${n.chapter}:${n.verse}`.includes(q)
    );
  });

  return (
    <div className="page">
      <h1 className="page-title">Notes</h1>

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
          <p>Tap on any verse while reading to add a note.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No notes match your search.</p>
        </div>
      ) : (
        <div className="notes-list">
          {filtered.map((note) => {
            const book = getBookById(note.bookId);
            const ref = `${book?.name || note.bookId} ${note.chapter}:${note.verse}`;

            return (
              <div key={note.id} className="card note-card">
                {editingNote?.id === note.id ? (
                  <div className="note-edit">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="note-edit-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setEditingNote(null)}
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
                      <button className="note-ref" onClick={() => goToVerse(note)}>
                        <BookOpen size={14} />
                        <span>{ref}</span>
                      </button>
                      <span className="note-date">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="note-text">{note.text}</p>
                    <div className="note-actions">
                      <button
                        className="note-action-btn"
                        onClick={() => {
                          setEditingNote(note);
                          setEditText(note.text);
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
