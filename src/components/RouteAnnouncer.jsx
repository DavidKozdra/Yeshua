import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_LABELS = {
  '/': 'Home',
  '/read': 'Read',
  '/notes': 'Notes',
  '/translations': 'Library',
  '/books': 'Library',
  '/settings': 'Settings',
  '/search': 'Search Results',
};

function getRouteLabel(pathname) {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];

  if (pathname.startsWith('/read/')) return 'Read';
  if (pathname.startsWith('/books/')) return 'Library';
  if (pathname.startsWith('/search')) return 'Search Results';

  return 'Page';
}

export default function RouteAnnouncer() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const label = getRouteLabel(location.pathname);
    setAnnouncement(`Navigated to ${label}`);
  }, [location.pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
