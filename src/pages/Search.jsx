import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search as SearchIcon } from 'lucide-react';
import { AVAILABLE_TRANSLATIONS, getTranslationById } from '../utils/bibleData';
import { getAllDownloadedTranslations } from '../utils/db';
import { subscribeToTranslationInstallEvents } from '../utils/api';
import { getTranslationStatus } from '../utils/translationStatus';
import { getSettings } from '../utils/storage';
import { searchTranslationText } from '../utils/search';
import '../styles/search.css';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
  if (!query) return text;

  const matcher = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(matcher);
  const normalizedQuery = query.toLowerCase();

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery ? <mark key={`${part}-${index}`}>{part}</mark> : part
  );
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
  const settings = getSettings();
  const query = searchParams.get('q')?.trim() || '';
  const requestedTranslationId = searchParams.get('translation') || settings.defaultTranslation;

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
    let cancelled = false;

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
        const searchResult = await searchTranslationText(activeTranslationId, query);
        if (cancelled) return;

        setResults(searchResult.results);
        setTotalMatches(searchResult.totalMatches);
        setTruncated(searchResult.truncated);
      } catch (error) {
        if (cancelled) return;

        setResults([]);
        setTotalMatches(0);
        setTruncated(false);
        setSearchError(error.message || 'Search failed.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [activeTranslationId, query]);

  function updateTranslation(translationId) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('translation', translationId);
    setSearchParams(nextParams);
  }

  function openResult(result) {
    navigate({
      pathname: `/read/${activeTranslationId}/${result.bookId}/${result.chapter}`,
      hash: `#v${result.verse}`,
    });
  }

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

      {fallbackNotice && <p className="search-note">{fallbackNotice}</p>}

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
          <div className="search-summary card" role="status" aria-live="polite">
            <div className="search-summary-copy">
              <span className="chip">
                <SearchIcon size={12} />
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
            <div className="search-results">
              {results.map((result) => (
                <button
                  key={`${result.bookId}:${result.chapter}:${result.verse}`}
                  type="button"
                  className="card card-clickable search-result-card"
                  onClick={() => openResult(result)}
                >
                  <div className="search-result-header">
                    <strong>
                      {result.bookName} {result.chapter}:{result.verse}
                    </strong>
                    <span className="search-result-link">
                      Open
                      <ArrowRight size={14} />
                    </span>
                  </div>
                  <p className="search-result-text">{highlightText(result.text, query)}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
