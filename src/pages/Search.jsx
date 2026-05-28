import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search as SearchIcon } from 'lucide-react';
import { AVAILABLE_TRANSLATIONS, BIBLE_BOOKS, getTranslationById } from '../utils/bibleData';
import { getAllDownloadedTranslations } from '../utils/db';
import { subscribeToTranslationInstallEvents } from '../utils/api';
import { getTranslationStatus } from '../utils/translationStatus';
import { searchContent } from '../utils/search';
import { useAppSettings } from '../hooks/useAppSettings';
import { buildVerseLocation } from '../utils/verseSharing';
import '../styles/search.css';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeHighlighter(query) {
  if (!query) return null;
  const matcher = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const normalizedQuery = query.toLowerCase();
  return function highlightText(text) {
    const parts = text.split(matcher);
    return parts.map((part, index) =>
      part.toLowerCase() === normalizedQuery ? <mark key={`${part}-${index}`}>{part}</mark> : part
    );
  };
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);
  const [results, setResults] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const settings = useAppSettings();
  const query = searchParams.get('q')?.trim() || '';
  const requestedTranslationId = searchParams.get('translation') || settings.defaultTranslation;
  const sourceFilter = searchParams.get('sources') || 'bible';
  const testamentFilter = searchParams.get('testament') || '';
  const exactPhrase = searchParams.get('exact') === '1';
  const wholeWord = searchParams.get('whole') === '1';
  const includeNotes = searchParams.get('notes') === '1';
  const selectedBookId = searchParams.get('book') || '';

  const translationMetaMap = useMemo(
    () => new Map(downloadedTranslations.map((item) => [item.id, item])),
    [downloadedTranslations]
  );

  const readyTranslations = useMemo(
    () =>
      AVAILABLE_TRANSLATIONS.filter((translation) =>
        getTranslationStatus(translation.id, translationMetaMap.get(translation.id)).canReadNow
      ),
    [translationMetaMap]
  );

  const activeTranslationId = readyTranslations.some((translation) => translation.id === requestedTranslationId)
    ? requestedTranslationId
    : readyTranslations[0]?.id || null;
  const activeTranslation = activeTranslationId ? getTranslationById(activeTranslationId) : null;

  useEffect(() => {
    let cancelled = false;

    async function loadDownloadedTranslations() {
      const translations = await getAllDownloadedTranslations({ includeIncomplete: true });
      if (!cancelled) {
        setDownloadedTranslations(translations);
      }
    }

    loadDownloadedTranslations();
    const unsubscribe = subscribeToTranslationInstallEvents((event) => {
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloadedTranslations();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function runSearch() {
      if (!query) {
        setResults([]);
        setTotalMatches(0);
        setTruncated(false);
        setSearchError('');
        setLoading(false);
        return;
      }

      if (query.length < 2) {
        setResults([]);
        setTotalMatches(0);
        setTruncated(false);
        setSearchError('Enter at least 2 letters to search the text.');
        setLoading(false);
        return;
      }

      if (!activeTranslationId) {
        setResults([]);
        setTotalMatches(0);
        setTruncated(false);
        setSearchError('Download or include a translation before running full-text search.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setSearchError('');

      try {
        const searchResult = await searchContent({
          translationId: activeTranslationId,
          query,
          signal: controller.signal,
          sourceTypes: sourceFilter.split(',').filter(Boolean),
          testament: testamentFilter,
          exactPhrase,
          wholeWord,
          includeNotes,
          books: selectedBookId ? [selectedBookId] : [],
        });

        setResults(searchResult.results);
        setTotalMatches(searchResult.totalMatches);
        setTruncated(searchResult.truncated);
      } catch (error) {
        if (error.name === 'AbortError') return;

        setResults([]);
        setTotalMatches(0);
        setTruncated(false);
        setSearchError(error.message || 'Search failed.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      controller.abort();
    };
  }, [
    activeTranslationId,
    query,
    sourceFilter,
    testamentFilter,
    exactPhrase,
    wholeWord,
    includeNotes,
    selectedBookId,
  ]);

  function updateTranslation(translationId) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('translation', translationId);
    setSearchParams(nextParams);
  }

  function updateSearchParam(key, value) {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);
  }

  function updateBooleanParam(key, checked) {
    updateSearchParam(key, checked ? '1' : '');
  }

  function openResult(result) {
    if (result.sourceType === 'library') {
      navigate(`/books/${result.collectionId}/${result.workId}/${result.chapter}`);
      return;
    }

    if (result.sourceType === 'note') {
      navigate('/notes');
      return;
    }

    navigate(
      buildVerseLocation({
        translationId: activeTranslationId,
        bookId: result.bookId,
        chapter: result.chapter,
        verse: result.verse,
      })
    );
  }

  const highlightText = useMemo(() => makeHighlighter(query), [query]);

  const fallbackNotice =
    requestedTranslationId && activeTranslationId && requestedTranslationId !== activeTranslationId
      ? `${getTranslationById(requestedTranslationId)?.abbreviation || requestedTranslationId.toUpperCase()} is not ready for full-text search yet, so results are showing in ${activeTranslation?.abbreviation}.`
      : '';

  return (
    <div className="page search-page">
      <div className="search-page-header">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="search-page-intro">
            Full-text search scans the selected offline translation and opens any result at the exact verse.
          </p>
        </div>
        {readyTranslations.length > 0 && (
          <div className="search-translation-picker">
            <label htmlFor="search-translation">Translation</label>
            <select
              id="search-translation"
              value={activeTranslationId || ''}
              onChange={(event) => updateTranslation(event.target.value)}
            >
              {readyTranslations.map((translation) => (
                <option key={translation.id} value={translation.id}>
                  {translation.abbreviation} - {translation.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="search-filters card" aria-label="Search filters">
        <label>
          <span>Sources</span>
          <select
            value={sourceFilter}
            onChange={(event) => updateSearchParam('sources', event.target.value)}
          >
            <option value="bible">Bible</option>
            <option value="bible,library">Bible + Library</option>
            <option value="library">Library</option>
          </select>
        </label>
        <label>
          <span>Book</span>
          <select
            value={selectedBookId}
            onChange={(event) => updateSearchParam('book', event.target.value)}
            disabled={!sourceFilter.includes('bible')}
          >
            <option value="">All books</option>
            {BIBLE_BOOKS.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Testament</span>
          <select
            value={testamentFilter}
            onChange={(event) => updateSearchParam('testament', event.target.value)}
            disabled={!sourceFilter.includes('bible') || Boolean(selectedBookId)}
          >
            <option value="">Both</option>
            <option value="OT">Old Testament</option>
            <option value="NT">New Testament</option>
          </select>
        </label>
        <label className="search-filter-check">
          <input
            type="checkbox"
            checked={exactPhrase}
            onChange={(event) => updateBooleanParam('exact', event.target.checked)}
          />
          <span>Exact phrase</span>
        </label>
        <label className="search-filter-check">
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(event) => updateBooleanParam('whole', event.target.checked)}
          />
          <span>Whole word</span>
        </label>
        <label className="search-filter-check">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => updateBooleanParam('notes', event.target.checked)}
          />
          <span>Include notes</span>
        </label>
      </div>

      {fallbackNotice && <p className="search-note" role="status">{fallbackNotice}</p>}

      {!query ? (
        <div className="empty-state">
          <h3>Search the Bible text</h3>
          <p>Use the bar at the top to search words or phrases like begat, shepherd, or kingdom of heaven.</p>
        </div>
      ) : searchError ? (
        <div className="empty-state">
          <h3>Search unavailable</h3>
          <p>{searchError}</p>
        </div>
      ) : (
        <>
          <div className="search-summary card" role="status" aria-live="polite" aria-busy={loading}>
            <div className="search-summary-copy">
              <span className="chip">
                <SearchIcon size={12} aria-hidden="true" />
                {activeTranslation?.abbreviation || 'Offline search'}
              </span>
              <p>
                {loading
                  ? `Searching for "${query}"...`
                  : `${totalMatches} match${totalMatches === 1 ? '' : 'es'} for "${query}"`}
              </p>
            </div>
            {truncated && (
              <p className="search-summary-note">
                Showing the first {results.length} matches. Narrow the query to reduce results.
              </p>
            )}
          </div>

          {loading ? (
            <div className="loading-spinner" role="status" aria-live="polite">Searching...</div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <h3>No matches found</h3>
              <p>Try a different word, a shorter phrase, or another translation.</p>
            </div>
          ) : (
            <div className="search-results" aria-busy={loading}>
              {results.map((result, index) => (
                <button
                  key={`${result.sourceType}:${result.bookId || result.collectionId || result.noteId}:${result.workId || ''}:${result.chapter || ''}:${result.verse || ''}:${index}`}
                  type="button"
                  className="card card-clickable search-result-card"
                  aria-label={`Open ${
                    result.bookName || result.workTitle || result.title || result.type
                  }`}
                  onClick={() => openResult(result)}
                >
                  <div className="search-result-header">
                    <strong>
                      {result.sourceType === 'library'
                        ? `${result.workTitle} ${result.chapter}${result.verse ? `:${result.verse}` : ''}`
                        : result.sourceType === 'note'
                          ? result.title
                          : `${result.bookName} ${result.chapter}:${result.verse}`}
                    </strong>
                    <span className="search-result-link">
                      Open
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                  <span className="chip search-result-source">{result.type}</span>
                  {result.tags?.length > 0 && (
                    <span className="search-result-tags">{result.tags.join(', ')}</span>
                  )}
                  <p className="search-result-text">{highlightText ? highlightText(result.text) : result.text}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
