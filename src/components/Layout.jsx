import { Outlet, NavLink } from 'react-router-dom';
import { Home, BookOpen, Languages, StickyNote, SettingsIcon } from 'lucide-react';
import ToastHost from './ToastHost';
import '../styles/layout.css';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/read', icon: BookOpen, label: 'Read' },
  { to: '/translations', icon: Languages, label: 'Translations' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Layout() {
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
        <Outlet />
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
