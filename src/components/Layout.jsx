import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Languages, StickyNote, SettingsIcon } from 'lucide-react';
import ToastHost from './ToastHost';
import GlobalSearchBar from './GlobalSearchBar';
import HolyDayBanner from './HolyDayBanner';
import HolyDayReminderManager from './HolyDayReminderManager';
import { getSettings, subscribeToSettings } from '../utils/storage';
import '../styles/layout.css';

const BASE_NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/read', icon: BookOpen, label: 'Read' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/translations', icon: Languages, label: 'Translations' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();
  const [settings, setSettings] = useState(getSettings);
  const isReaderRoute =
    location.pathname.startsWith('/read') || location.pathname.startsWith('/books/');
  const navItems = settings.showBooksTab
    ? [
        ...BASE_NAV_ITEMS.slice(0, 2),
        { to: '/books', icon: BookOpen, label: 'Books' },
        ...BASE_NAV_ITEMS.slice(2),
      ]
    : BASE_NAV_ITEMS;

  useEffect(() => subscribeToSettings(setSettings), []);

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-icon">Y</span>
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
        <HolyDayBanner />

        <div className="content-shell">
          <Outlet />
        </div>
      </main>

      <HolyDayReminderManager />
      <ToastHost />

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
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
