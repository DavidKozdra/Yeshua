import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';
import { getSettings } from './utils/storage';
import { applyDisplayPreferences } from './utils/displayPreferences';
import { applyTheme } from './utils/theme';

// Apply saved theme before render to prevent flash
const initialSettings = getSettings();
applyTheme(initialSettings);
applyDisplayPreferences(initialSettings);

if (import.meta.env.PROD) {
  // When a new service worker takes control (after skipWaiting + clientsClaim),
  // reload once so the already-open page swaps to the new code. Without this,
  // installed Android PWAs keep running the old JS because the process stays
  // warm in the background and the page is never torn down. The guard prevents
  // an infinite reload loop.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // Proactively poll for a new SW so backgrounded PWAs pick up updates
      // without waiting for the browser's own (infrequent) update check.
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000); // hourly
    },
    onOfflineReady() {
      console.log('[Yeshua] Offline support is ready.');
    },
    onRegisterError(error) {
      console.error('[Yeshua] Service worker registration failed:', error);
    },
  });
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
