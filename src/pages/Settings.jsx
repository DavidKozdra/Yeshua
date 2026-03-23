import { useState, useEffect } from 'react';
import { Sun, BookOpen, Type, Eye, Palette } from 'lucide-react';
import { getSettings, saveSettings } from '../utils/storage';
import {
  AVAILABLE_TRANSLATIONS,
  BIBLE_BOOKS,
  getBookById,
  getTranslationById,
} from '../utils/bibleData';
import { getAllDownloadedTranslations } from '../utils/db';
import { fetchChapter, subscribeToTranslationInstallEvents } from '../utils/api';
import { getTranslationSelectLabel, getTranslationStatus } from '../utils/translationStatus';
import {
  applyTheme,
  BUILT_IN_THEMES,
  CUSTOM_THEME_DEFAULT,
  buildCustomThemeVariables,
  createCustomThemeId,
  getActiveCustomTheme,
  normalizeCustomTheme,
} from '../utils/theme';
import '../styles/settings.css';

const PREVIEW_DEFAULT = {
  bookId: 'JHN',
  chapter: 3,
  verse: 16,
};

const BOOK_ALIASES = {
  genisis: 'GEN',
  genesis: 'GEN',
  psalm: 'PSA',
  psalms: 'PSA',
  songofsongs: 'SNG',
  songofsolomon: 'SNG',
  songsolomon: 'SNG',
};

const CUSTOM_THEME_FIELDS = [
  { key: 'bgPrimary', label: 'Background' },
  { key: 'bgSecondary', label: 'Surface' },
  { key: 'bgInput', label: 'Input' },
  { key: 'textPrimary', label: 'Primary Text' },
  { key: 'textSecondary', label: 'Secondary Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'success', label: 'Success' },
  { key: 'danger', label: 'Danger' },
];

const BUILT_IN_THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
  sepia: 'Sepia',
};

function formatPreviewReference(bookId, chapter, verse) {
  return `${getBookById(bookId)?.name || bookId} ${chapter}:${verse}`;
}

function normalizeBookToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseReferenceInput(input) {
  const match = input.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
  if (!match) return null;

  const [, rawBook, rawChapter, rawVerse] = match;
  const normalizedBook = BOOK_ALIASES[normalizeBookToken(rawBook)] || normalizeBookToken(rawBook);
  const book = BIBLE_BOOKS.find((item) => {
    const normalizedName = normalizeBookToken(item.name);
    const normalizedId = normalizeBookToken(item.id);
    return normalizedBook === normalizedName || normalizedBook === normalizedId;
  });

  if (!book) return null;

  const chapter = Number.parseInt(rawChapter, 10);
  const verse = rawVerse ? Number.parseInt(rawVerse, 10) : 1;

  if (Number.isNaN(chapter) || chapter < 1 || chapter > book.chapters) return null;
  if (Number.isNaN(verse) || verse < 1) return null;

  return { bookId: book.id, chapter, verse };
}

export default function Settings() {
  const [settings, setSettings] = useState(getSettings);
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeDraft, setThemeDraft] = useState(() => normalizeCustomTheme(CUSTOM_THEME_DEFAULT));
  const [themeDraftName, setThemeDraftName] = useState('');
  const [themeNameError, setThemeNameError] = useState('');
  const [editingThemeId, setEditingThemeId] = useState(null);
  const [previewBookId, setPreviewBookId] = useState(PREVIEW_DEFAULT.bookId);
  const [previewChapter, setPreviewChapter] = useState(PREVIEW_DEFAULT.chapter);
  const [previewVerse, setPreviewVerse] = useState(PREVIEW_DEFAULT.verse);
  const [referenceInput, setReferenceInput] = useState(
    formatPreviewReference(PREVIEW_DEFAULT.bookId, PREVIEW_DEFAULT.chapter, PREVIEW_DEFAULT.verse)
  );
  const [referenceError, setReferenceError] = useState('');
  const [previewVerses, setPreviewVerses] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');

  const translationMetaMap = new Map(downloadedTranslations.map((item) => [item.id, item]));
  const translationStatuses = AVAILABLE_TRANSLATIONS.map((translation) => ({
    translation,
    status: getTranslationStatus(translation.id, translationMetaMap.get(translation.id)),
  }));
  const readyTranslations = translationStatuses.filter((item) => item.status.canReadNow);
  const readyTranslationIds = new Set(readyTranslations.map((item) => item.translation.id));
  const previewTranslationId = readyTranslationIds.has(settings.defaultTranslation)
    ? settings.defaultTranslation
    : readyTranslations[0]?.translation.id || null;
  const previewTranslation = previewTranslationId
    ? getTranslationById(previewTranslationId)
    : null;
  const previewTranslationStatus = previewTranslationId
    ? getTranslationStatus(previewTranslationId, translationMetaMap.get(previewTranslationId))
    : null;
  const selectedPreviewVerse =
    previewVerses.find((item) => item.verse === previewVerse) || previewVerses[0] || null;
  const activeCustomTheme = getActiveCustomTheme(settings);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    async function loadDownloadedTranslations() {
      const translations = await getAllDownloadedTranslations({ includeIncomplete: true });
      if (!cancelled) {
        setDownloadedTranslations(translations);
      }
    }

    loadDownloadedTranslations();
    const unsubscribe = subscribeToTranslationInstallEvents((event) => {
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloadedTranslations();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setReferenceInput(formatPreviewReference(previewBookId, previewChapter, previewVerse));
    setReferenceError('');
  }, [previewBookId, previewChapter, previewVerse]);

  useEffect(() => {
    if (!previewTranslationId) {
      setPreviewVerses([]);
      setPreviewLoading(false);
      setPreviewError('Download a translation to preview verses offline.');
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError('');

      try {
        const verses = await fetchChapter(previewTranslationId, previewBookId, previewChapter, {
          offlineOnly: true,
        });

        if (cancelled) return;

        setPreviewVerses(verses);
        if (!verses.some((item) => item.verse === previewVerse) && verses[0]) {
          setPreviewVerse(verses[0].verse);
        }
      } catch (err) {
        if (cancelled) return;
        setPreviewVerses([]);
        setPreviewError(err.message);
      }

      if (!cancelled) {
        setPreviewLoading(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [previewTranslationId, previewBookId, previewChapter]);

  useEffect(() => {
    if (!previewVerses.length) return;
    if (!previewVerses.some((item) => item.verse === previewVerse)) {
      setPreviewVerse(previewVerses[0].verse);
    }
  }, [previewVerses, previewVerse]);

  function update(key, value) {
    const updated = { ...settings, [key]: value };
    if (key === 'theme') {
      const selectedCustomTheme = settings.customThemes.find((theme) => theme.id === value);
      if (selectedCustomTheme) {
        updated.customTheme = selectedCustomTheme.colors;
      }
    }
    setSettings(updated);
    saveSettings(updated);
  }

  function openThemeModal(themeToEdit = null) {
    setEditingThemeId(themeToEdit?.id || null);
    setThemeDraftName(themeToEdit?.name || '');
    setThemeDraft(normalizeCustomTheme(themeToEdit?.colors || CUSTOM_THEME_DEFAULT));
    setThemeNameError('');
    setShowThemeModal(true);
  }

  function handleReferenceSubmit() {
    const parsed = parseReferenceInput(referenceInput);
    if (!parsed) {
      setReferenceError('Use a reference like John 3:16.');
      return;
    }

    setReferenceError('');
    setPreviewBookId(parsed.bookId);
    setPreviewChapter(parsed.chapter);
    setPreviewVerse(parsed.verse);
  }

  function handleSaveCustomTheme() {
    const trimmedName = themeDraftName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setThemeNameError('Enter a theme name.');
      return;
    }

    const normalizedColors = normalizeCustomTheme(themeDraft);
    const hasEditingTheme = settings.customThemes.some((theme) => theme.id === editingThemeId);
    const nextThemeId = hasEditingTheme
      ? editingThemeId
      : createCustomThemeId(trimmedName, settings.customThemes);
    const customThemes = hasEditingTheme
      ? settings.customThemes.map((theme) =>
          theme.id === editingThemeId
            ? { ...theme, name: trimmedName, colors: normalizedColors }
            : theme
        )
      : [
          ...settings.customThemes,
          { id: nextThemeId, name: trimmedName, colors: normalizedColors },
        ];
    const updated = {
      ...settings,
      theme: nextThemeId,
      customTheme: normalizedColors,
      customThemes,
    };

    setSettings(updated);
    saveSettings(updated);
    setThemeNameError('');
    setShowThemeModal(false);
  }

  const translationOptions = [...translationStatuses].sort(
    (a, b) =>
      Number(b.status.canReadNow) - Number(a.status.canReadNow) ||
      Number(b.status.isSavedOnDevice) - Number(a.status.isSavedOnDevice)
  );
  const customPreviewStyle = buildCustomThemeVariables(themeDraft);

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div className="settings-sections">
        <section className="settings-section">
          <p className="section-label">Appearance</p>
          <div className="card settings-card-group">
            <div className="setting-row setting-row-stack">
              <div className="setting-label">
                <Sun size={18} />
                <span>Theme</span>
              </div>
              <div className="theme-options">
                {BUILT_IN_THEMES.map((themeName) => (
                  <button
                    key={themeName}
                    className={`theme-btn theme-${themeName} ${
                      settings.theme === themeName ? 'active' : ''
                    }`}
                    onClick={() => update('theme', themeName)}
                  >
                    {BUILT_IN_THEME_LABELS[themeName]}
                  </button>
                ))}
                {settings.customThemes.map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-btn theme-custom-saved ${
                      settings.theme === theme.id ? 'active' : ''
                    }`}
                    onClick={() => update('theme', theme.id)}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
              <div className="theme-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => openThemeModal(activeCustomTheme)}
                >
                  <Palette size={14} />
                  {activeCustomTheme ? `Edit ${activeCustomTheme.name}` : 'Create Custom Theme'}
                </button>
                {activeCustomTheme && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => openThemeModal()}
                  >
                    <Palette size={14} />
                    New Theme
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

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

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <BookOpen size={18} />
                <span>One Verse Per Line</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.oneVersePerLine}
                  onChange={(e) => update('oneVersePerLine', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>

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
                {translationOptions.map(({ translation, status }) => (
                  <option key={translation.id} value={translation.id}>
                    {getTranslationSelectLabel(translation, translationMetaMap.get(translation.id))}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <p className="section-label">Preview</p>
          <div className="card settings-card-group">
            <div className="preview-toolbar">
              <div className="preview-reference">
                <input
                  type="text"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  onBlur={handleReferenceSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleReferenceSubmit();
                    }
                  }}
                  placeholder="John 3:16"
                />
                <button className="btn btn-outline btn-sm" onClick={handleReferenceSubmit}>
                  Go
                </button>
              </div>
              {referenceError && <p className="settings-help error">{referenceError}</p>}
            </div>

            <div className="preview-selectors">
              <select
                value={previewBookId}
                onChange={(e) => setPreviewBookId(e.target.value)}
              >
                {BIBLE_BOOKS.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
              <select
                value={previewChapter}
                onChange={(e) => setPreviewChapter(Number.parseInt(e.target.value, 10))}
              >
                {Array.from(
                  { length: getBookById(previewBookId)?.chapters || 0 },
                  (_, index) => index + 1
                ).map((chapterOption) => (
                  <option key={chapterOption} value={chapterOption}>
                    Chapter {chapterOption}
                  </option>
                ))}
              </select>
              <select
                value={previewVerse}
                onChange={(e) => setPreviewVerse(Number.parseInt(e.target.value, 10))}
                disabled={!previewVerses.length}
              >
                {previewVerses.map((verseOption) => (
                  <option key={verseOption.verse} value={verseOption.verse}>
                    Verse {verseOption.verse}
                  </option>
                ))}
              </select>
            </div>

            <div className="preview-meta">
              <span className="chip">
                {previewTranslation
                  ? `${previewTranslation.abbreviation} preview · ${previewTranslationStatus?.statusLabel || 'Ready now'}`
                  : 'Offline preview unavailable'}
              </span>
              {previewTranslationId && previewTranslationId !== settings.defaultTranslation && (
                <span className="settings-help">
                  Preview is using a translation that is ready now because your default is not available for offline reading yet.
                </span>
              )}
              {previewTranslationStatus?.detailLabel && (
                <span className="settings-help">{previewTranslationStatus.detailLabel}</span>
              )}
            </div>

            <div
              className="card reading-preview"
              style={{
                fontFamily: 'var(--font-reading)',
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
              }}
            >
              {previewLoading ? (
                <p className="settings-help">Loading preview...</p>
              ) : previewError ? (
                <p className="settings-help error">{previewError}</p>
              ) : selectedPreviewVerse ? (
                <>
                  {settings.showVerseNumbers && (
                    <sup className="verse-num">{selectedPreviewVerse.verse}</sup>
                  )}
                  {selectedPreviewVerse.text}
                </>
              ) : (
                <p className="settings-help">No verse available for this selection.</p>
              )}
            </div>
          </div>
        </section>

        <p className="settings-footer">
          Yeshua Bible Reader &middot; All data stored locally on your device.
        </p>
      </div>

      {showThemeModal && (
        <div className="modal-overlay" onClick={() => setShowThemeModal(false)}>
          <div className="modal theme-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingThemeId ? 'Edit Custom Theme' : 'Create Custom Theme'}</h2>
            <div className="theme-name-field">
              <label htmlFor="custom-theme-name">Theme Name</label>
              <input
                id="custom-theme-name"
                type="text"
                value={themeDraftName}
                onChange={(e) => {
                  setThemeDraftName(e.target.value);
                  if (themeNameError) {
                    setThemeNameError('');
                  }
                }}
                placeholder="Evening Gold"
                autoFocus
              />
              {themeNameError && <p className="settings-help error">{themeNameError}</p>}
            </div>
            <div className="theme-editor-grid">
              {CUSTOM_THEME_FIELDS.map((field) => (
                <label key={field.key} className="theme-color-field">
                  <span>{field.label}</span>
                  <div className="theme-color-input">
                    <input
                      type="color"
                      value={themeDraft[field.key]}
                      onChange={(e) =>
                        setThemeDraft((current) => ({
                          ...current,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                    <code>{themeDraft[field.key]}</code>
                  </div>
                </label>
              ))}
            </div>

            <div className="theme-modal-preview" style={customPreviewStyle}>
              <div className="theme-modal-card">
                <div className="theme-modal-topline">
                  <span className="chip">{themeDraftName.trim() || 'Custom Theme'}</span>
                  <span className="theme-modal-ref">
                    {formatPreviewReference(previewBookId, previewChapter, previewVerse)}
                  </span>
                </div>
                <p className="theme-modal-copy">
                  {selectedPreviewVerse?.text ||
                    'Your custom colors will show up across reading, notes, and navigation.'}
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setThemeDraft({ ...CUSTOM_THEME_DEFAULT })}
              >
                Reset
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowThemeModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveCustomTheme}>
                Save Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
