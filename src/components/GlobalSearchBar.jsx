import { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getBookById } from '../utils/bibleData';
import { parseReferenceInput } from '../utils/reference';
import { getLastRead, getSettings, subscribeToSettings } from '../utils/storage';
import { buildVerseLocation } from '../utils/verseSharing';

export default function GlobalSearchBar({
  translationId,
  variant = 'default',
  placeholder = 'Jump to John 3:16 or search any word or phrase',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState(getSettings);
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState('');
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  useEffect(() => subscribeToSettings(setSettings), []);

  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      setSearchValue(params.get('q') || '');
      return;
    }

    setSearchError('');
  }, [location.pathname, location.search]);

  function resolveSearchTranslationId() {
    return translationId || getLastRead()?.translationId || settings.defaultTranslation;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    const trimmedQuery = searchValue.trim();
    const parsedReference = parseReferenceInput(trimmedQuery);
    if (!parsedReference) {
      if (trimmedQuery.length < 2) {
        setSearchError('Enter at least 2 letters to search.');
        return;
      }

      setSearchError('');
      navigate({
        pathname: '/search',
        search: `?q=${encodeURIComponent(trimmedQuery)}&translation=${encodeURIComponent(
          resolveSearchTranslationId()
        )}`,
      });
      return;
    }

    const resolvedTranslationId = resolveSearchTranslationId();
    const destination = parsedReference.hasExplicitVerse
      ? buildVerseLocation({
          translationId: resolvedTranslationId,
          bookId: parsedReference.bookId,
          chapter: parsedReference.chapter,
          verse: parsedReference.verse,
        })
      : {
          pathname: `/read/${resolvedTranslationId}/${parsedReference.bookId}/${parsedReference.chapter}`,
        };

    setSearchError('');
    setSearchValue(
      `${getBookById(parsedReference.bookId)?.name || parsedReference.bookId} ${parsedReference.chapter}${
        parsedReference.hasExplicitVerse ? `:${parsedReference.verse}` : ''
      }`
    );
    navigate(destination);
  }

  const shellClassName =
    variant === 'inline'
      ? 'global-search-shell global-search-shell-inline'
      : 'global-search-shell';
  const formClassName =
    variant === 'inline'
      ? 'global-search-form global-search-form-inline'
      : 'global-search-form';
  const errorClassName =
    variant === 'inline'
      ? 'global-search-error global-search-error-inline'
      : 'global-search-error';

  return (
    <div className={shellClassName}>
      <form className={formClassName} onSubmit={handleSearchSubmit} role="search">
        <Search size={16} aria-hidden="true" />
        <label className="sr-only" htmlFor={inputId}>
          Search by Bible reference or full-text query
        </label>
        <input
          id={inputId}
          type="text"
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value);
            if (searchError) {
              setSearchError('');
            }
          }}
          placeholder={placeholder}
          aria-describedby={searchError ? errorId : hintId}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          inputMode="search"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary btn-sm">
          Go
        </button>
      </form>
      <p className="sr-only" id={hintId}>
        Enter a reference like John 3:16 or type at least two letters to run a full-text search.
      </p>
      {searchError && (
        <p className={errorClassName} id={errorId} role="alert">
          {searchError}
        </p>
      )}
    </div>
  );
}
