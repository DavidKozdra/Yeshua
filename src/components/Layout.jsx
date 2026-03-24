import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, LibraryBig, StickyNote, SettingsIcon } from 'lucide-react';
import ToastHost from './ToastHost';
import GlobalSearchBar from './GlobalSearchBar';
import { getSettings, subscribeToSettings } from '../utils/storage';
import '../styles/layout.css';

const BASE_NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/read', icon: BookOpen, label: 'Read' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/translations', icon: LibraryBig, label: 'Library' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();
  const [settings, setSettings] = useState(getSettings);
  const isReaderRoute =
    location.pathname.startsWith('/read') || location.pathname.startsWith('/books/');
  const navItems = BASE_NAV_ITEMS;
  const readItem = navItems.find((item) => item.to === '/read') || null;
  const mobileNavItems = (() => {
    if (!readItem) return navItems;
    const itemsWithoutRead = navItems.filter((item) => item.to !== '/read');
    const insertIndex = Math.ceil(itemsWithoutRead.length / 2);
    return [
      ...itemsWithoutRead.slice(0, insertIndex),
      readItem,
      ...itemsWithoutRead.slice(insertIndex),
    ];
  })();

  useEffect(() => subscribeToSettings(setSettings), []);

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 1024 1024" role="presentation" focusable="false">
              <defs>
                <linearGradient id="sidebar-brand-bg" x1="128" y1="96" x2="896" y2="928" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#203a63" />
                  <stop offset="0.55" stopColor="#1a1a2e" />
                  <stop offset="1" stopColor="#2b1b1f" />
                </linearGradient>
                <linearGradient id="sidebar-brand-accent" x1="320" y1="214" x2="706" y2="814" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#f4e7c9" />
                  <stop offset="1" stopColor="#d2b173" />
                </linearGradient>
              </defs>
              <rect width="1024" height="1024" rx="232" fill="url(#sidebar-brand-bg)" />
              <circle cx="512" cy="512" r="360" fill="none" stroke="#f1dfb7" strokeOpacity="0.16" strokeWidth="30" />
              <path
                d="M322 264 512 474 702 264"
                fill="none"
                stroke="url(#sidebar-brand-accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="96"
              />
              <path
                d="M512 474V794"
                fill="none"
                stroke="url(#sidebar-brand-accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="96"
              />
              <circle cx="512" cy="190" r="32" fill="#f4e7c9" fillOpacity="0.92" />
            </svg>
          </span>
          <span className="brand-text">Yeshua</span>
        </div>
        <ul className="nav-list">
          {navItems.map(({ to, icon: Icon, label }) => (
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
        {settings.showGlobalSearchBar && !isReaderRoute && <GlobalSearchBar />}

        <div className="content-shell">
          <Outlet />
        </div>
      </main>

      <ToastHost />

      <nav className="bottom-nav" aria-label="Main navigation">
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `bottom-nav-link ${to === '/read' ? 'bottom-nav-link-read' : ''} ${
                isActive ? 'active' : ''
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
