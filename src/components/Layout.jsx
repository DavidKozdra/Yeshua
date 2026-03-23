import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Languages, StickyNote, SettingsIcon, Search } from 'lucide-react';
import ToastHost from './ToastHost';
import { getBookById } from '../utils/bibleData';
import { parseReferenceInput } from '../utils/reference';
import { getLastRead, getSettings, subscribeToSettings } from '../utils/storage';
import '../styles/layout.css';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/read', icon: BookOpen, label: 'Read' },
  { to: '/translations', icon: Languages, label: 'Translations' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeReadMatch = useMatch('/read/:translationId/:bookId/:chapter');
  const [settings, setSettings] = useState(getSettings);
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState('');

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
    return activeReadMatch?.params.translationId ||
      getLastRead()?.translationId ||
      settings.defaultTranslation;
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

    const translationId = resolveSearchTranslationId();
    const hash = parsedReference.verse > 1 ? `#v${parsedReference.verse}` : '';

    setSearchError('');
    setSearchValue(
      `${getBookById(parsedReference.bookId)?.name || parsedReference.bookId} ${parsedReference.chapter}${
        parsedReference.verse > 1 ? `:${parsedReference.verse}` : ''
      }`
    );
    navigate({
      pathname: `/read/${translationId}/${parsedReference.bookId}/${parsedReference.chapter}`,
      hash,
    });
  }

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-icon">Y</span>
          <span className="brand-text">Yeshua</span>
        </div>
        <ul className="nav-list">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={22} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="main-content">
        {settings.showGlobalSearchBar && (
          <div className="global-search-shell">
            <form className="global-search-form" onSubmit={handleSearchSubmit}>
              <Search size={16} />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  if (searchError) {
                    setSearchError('');
                  }
                }}
                placeholder="Jump to John 3:16 or search begat"
                aria-label="Jump to a Bible reference"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Go
              </button>
            </form>
            {searchError && <p className="global-search-error">{searchError}</p>}
          </div>
        )}

        <div className="content-shell">
          <Outlet />
        </div>
      </main>

      <ToastHost />

      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
