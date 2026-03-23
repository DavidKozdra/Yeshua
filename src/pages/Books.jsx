import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ExternalLink, Globe } from 'lucide-react';
import { BOOKS_TAB_COLLECTIONS } from '../utils/booksData';
import { getLastRead, getSettings, subscribeToSettings } from '../utils/storage';
import '../styles/books.css';

function getBibleTarget(settings) {
  const lastRead = getLastRead();
  return {
    translationId: lastRead?.translationId || settings.defaultTranslation,
    bookId: lastRead?.bookId || 'JHN',
    chapter: lastRead?.chapter || 1,
  };
}

export default function Books() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => subscribeToSettings(setSettings), []);

  function openBibleReader() {
    const target = getBibleTarget(settings);
    navigate(`/read/${target.translationId}/${target.bookId}/${target.chapter}`);
  }

  return (
    <div className="page books-page">
      <div className="card books-hero">
        <div className="books-hero-copy">
          <span className="chip">
            <BookOpen size={12} />
            Abrahamic library
          </span>
          <h1 className="page-title books-title">Books</h1>
          <p className="books-intro">
            This tab widens Yeshua beyond the Bible reader. Bible reading stays fully offline and
            searchable; the added collections use either bundled starter passages or official
            source links.
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

      {BOOKS_TAB_COLLECTIONS.map((collection) => (
        <section key={collection.id} className="books-section">
          <div className="books-section-header">
            <div>
              <p className="section-label">{collection.tradition}</p>
              <h2>{collection.name}</h2>
            </div>
            <span className="chip">
              <Globe size={12} />
              {collection.kind === 'reader'
                ? 'Read in app'
                : collection.kind === 'external'
                  ? 'Official links'
                  : 'Primary reader'}
            </span>
          </div>
          <p className="books-section-copy">{collection.description}</p>
          {collection.summary && <p className="books-section-summary">{collection.summary}</p>}

          {collection.kind === 'bible' ? (
            <button type="button" className="card card-clickable book-resource-card" onClick={openBibleReader}>
              <div className="book-resource-copy">
                <strong>{collection.actionLabel}</strong>
                <p>Jump back into your last chapter or start from John 1 in the current default translation.</p>
              </div>
              <span className="book-resource-link">
                Open
                <ArrowRight size={16} />
              </span>
            </button>
          ) : (
            <div className="books-grid">
              {collection.works.map((work) =>
                collection.kind === 'external' ? (
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
                ) : (
                  <button
                    key={work.id}
                    type="button"
                    className="card card-clickable book-resource-card"
                    onClick={() => navigate(`/books/${collection.id}/${work.id}`)}
                  >
                    <div className="book-resource-copy">
                      <strong>{work.title}</strong>
                      <p className="book-resource-ref">{work.reference}</p>
                      <p>{work.description}</p>
                    </div>
                    <span className="book-resource-link">
                      Read
                      <ArrowRight size={16} />
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

