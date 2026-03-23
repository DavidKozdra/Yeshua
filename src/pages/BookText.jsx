import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  READER_COLLECTIONS,
  getBooksCollectionById,
  getBooksWorkById,
} from '../utils/booksData';
import { getSettings, subscribeToSettings } from '../utils/storage';
import '../styles/books.css';
import '../styles/read.css';

function getDefaultReaderPath() {
  const firstCollection = READER_COLLECTIONS[0];
  const firstWork = firstCollection?.works?.[0];

  if (!firstCollection || !firstWork) {
    return '/books';
  }

  return `/books/${firstCollection.id}/${firstWork.id}`;
}

export default function BookText() {
  const navigate = useNavigate();
  const params = useParams();
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => subscribeToSettings(setSettings), []);

  const collection =
    getBooksCollectionById(params.collectionId || READER_COLLECTIONS[0]?.id) ||
    READER_COLLECTIONS[0] ||
    null;
  const works = collection?.kind === 'reader' ? collection.works || [] : [];
  const work = getBooksWorkById(collection?.id, params.workId || works[0]?.id) || works[0] || null;
  const workIndex = works.findIndex((entry) => entry.id === work?.id);
  const previousWork = workIndex > 0 ? works[workIndex - 1] : null;
  const nextWork = workIndex >= 0 && workIndex < works.length - 1 ? works[workIndex + 1] : null;

  if (!collection || collection.kind !== 'reader' || !work) {
    return (
      <div className="page books-page">
        <div className="empty-state">
          <h1 className="page-title">Book Not Available</h1>
          <p>The requested text is not available in the in-app reader.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/books')}>
            Back to Books
          </button>
        </div>
      </div>
    );
  }

  function navigateToWork(collectionId, workId) {
    navigate(`/books/${collectionId}/${workId}`);
  }

  return (
    <div className="page book-reader-page">
      <div className="book-reader-toolbar">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/books')}>
          Back to Books
        </button>

        <div className="book-reader-picker-group">
          <select
            value={collection.id}
            onChange={(event) => {
              const nextCollection = getBooksCollectionById(event.target.value);
              const nextWorkId = nextCollection?.kind === 'reader' ? nextCollection.works?.[0]?.id : null;
              if (nextCollection?.kind === 'reader' && nextWorkId) {
                navigateToWork(nextCollection.id, nextWorkId);
              }
            }}
          >
            {READER_COLLECTIONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>

          <select value={work.id} onChange={(event) => navigateToWork(collection.id, event.target.value)}>
            {works.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card book-reader-shell">
        <p className="section-label">{collection.tradition}</p>
        <h1 className="page-title book-reader-title">{work.title}</h1>
        <p className="book-reader-subtitle">
          {work.subtitle} <span>{work.reference}</span>
        </p>
        <p className="book-reader-description">{work.description}</p>
        <div className="book-reader-meta">
          <span className="chip">{work.sourceLabel || collection.sourceLabel}</span>
          <span className="chip">Bundled starter text</span>
        </div>

        <div
          className="verses verses-stacked"
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          {work.passages.map((passage) => (
            <p key={passage.verse} className="verse book-reader-verse">
              {settings.showVerseNumbers && <sup className="verse-num">{passage.verse}</sup>}
              {passage.text}
            </p>
          ))}
        </div>

        <p className="book-reader-note">
          This reader is separate from Bible translations, download queues, notes, and full-text
          search so the existing Bible workflow remains stable.
        </p>

        <div className="chapter-nav">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              previousWork ? navigateToWork(collection.id, previousWork.id) : navigate('/books')
            }
          >
            <ChevronLeft size={16} />
            {previousWork ? previousWork.title : 'Books'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              nextWork ? navigateToWork(collection.id, nextWork.id) : navigate(getDefaultReaderPath())
            }
          >
            {nextWork ? nextWork.title : 'Start over'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

