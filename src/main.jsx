import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

// Apply saved theme before render to prevent flash
const savedTheme = (() => {
  try {
    const s = localStorage.getItem('yeshua-settings');
    return s ? JSON.parse(s).theme : 'dark';
  } catch { return 'dark'; }
})();
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
