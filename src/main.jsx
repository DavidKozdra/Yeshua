import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';
import { getSettings } from './utils/storage';
import { applyDisplayPreferences } from './utils/displayPreferences';
import { applyTheme } from './utils/theme';

// Apply saved theme before render to prevent flash
const initialSettings = getSettings();
applyTheme(initialSettings);
applyDisplayPreferences(initialSettings);

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
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
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
