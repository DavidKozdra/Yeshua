import { useState, useEffect } from 'react';
import { Sun, Moon, BookOpen, Type, Eye } from 'lucide-react';
import { getSettings, saveSettings } from '../utils/storage';
import { AVAILABLE_TRANSLATIONS } from '../utils/bibleData';
import '../styles/settings.css';

export default function Settings() {
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  function update(key, value) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  }

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div className="settings-sections">
        {/* Theme */}
        <section className="settings-section">
          <p className="section-label">Appearance</p>
          <div className="card">
            <div className="setting-row">
              <div className="setting-label">
                <Sun size={18} />
                <span>Theme</span>
              </div>
              <div className="theme-options">
                {['dark', 'light', 'sepia'].map((t) => (
                  <button
                    key={t}
                    className={`theme-btn theme-${t} ${settings.theme === t ? 'active' : ''}`}
                    onClick={() => update('theme', t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Reading */}
        <section className="settings-section">
          <p className="section-label">Reading</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <Type size={18} />
                <span>Font Size</span>
              </div>
              <div className="font-size-control">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => update('fontSize', Math.max(14, settings.fontSize - 1))}
                >
                  A-
                </button>
                <span className="font-size-value">{settings.fontSize}px</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => update('fontSize', Math.min(28, settings.fontSize + 1))}
                >
                  A+
                </button>
              </div>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <BookOpen size={18} />
                <span>Line Height</span>
              </div>
              <select
                value={settings.lineHeight}
                onChange={(e) => update('lineHeight', parseFloat(e.target.value))}
              >
                <option value={1.4}>Compact (1.4)</option>
                <option value={1.6}>Normal (1.6)</option>
                <option value={1.8}>Relaxed (1.8)</option>
                <option value={2.0}>Spacious (2.0)</option>
              </select>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Eye size={18} />
                <span>Verse Numbers</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showVerseNumbers}
                  onChange={(e) => update('showVerseNumbers', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>

        {/* Default Translation */}
        <section className="settings-section">
          <p className="section-label">Default Translation</p>
          <div className="card">
            <div className="setting-row">
              <div className="setting-label">
                <BookOpen size={18} />
                <span>Translation</span>
              </div>
              <select
                value={settings.defaultTranslation}
                onChange={(e) => update('defaultTranslation', e.target.value)}
              >
                {AVAILABLE_TRANSLATIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.abbreviation} - {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="settings-section">
          <p className="section-label">Preview</p>
          <div
            className="card reading-preview"
            style={{
              fontFamily: 'var(--font-reading)',
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
            }}
          >
            {settings.showVerseNumbers && <sup className="verse-num">1</sup>}
            In the beginning God created the heaven and the earth.{' '}
            {settings.showVerseNumbers && <sup className="verse-num">2</sup>}
            And the earth was without form, and void; and darkness was upon the face of the deep.
          </div>
        </section>

        <p className="settings-footer">
          Yeshua Bible Reader &middot; All data stored locally on your device.
        </p>
      </div>
    </div>
  );
}
