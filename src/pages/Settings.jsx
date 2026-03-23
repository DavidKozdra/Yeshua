import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  BookOpen,
  Type,
  Eye,
  Palette,
  Search,
  Volume2,
  CalendarDays,
  Bell,
  Download,
  ExternalLink,
  Globe,
  Trash2,
  User,
  Upload,
  FolderDown,
} from 'lucide-react';
import { getLastBooksRead, getProfile, getSettings, saveProfile, saveSettings } from '../utils/storage';
import {
  AVAILABLE_TRANSLATIONS,
  BIBLE_BOOKS,
  getBookById,
  getTranslationById,
} from '../utils/bibleData';
import {
  getAllDownloadedLibraryCollections,
  getAllDownloadedTranslations,
} from '../utils/db';
import { fetchChapter, subscribeToTranslationInstallEvents } from '../utils/api';
import {
  cancelBooksCollectionInstall,
  getBooksInstallQueueSnapshot,
  queueBooksCollectionInstall,
  removeBooksCollection,
  subscribeToBooksInstallEvents,
} from '../utils/booksApi';
import {
  BOOKS_TAB_COLLECTIONS,
  getBooksCollectionDefaultRoute,
  getBooksCollectionStats,
} from '../utils/booksData';
import { getBooksCollectionStatus } from '../utils/booksStatus';
import { getTranslationSelectLabel, getTranslationStatus } from '../utils/translationStatus';
import { parseReferenceInput } from '../utils/reference';
import {
  applyTheme,
  BUILT_IN_THEMES,
  CUSTOM_THEME_DEFAULT,
  buildCustomThemeVariables,
  createCustomThemeId,
  getActiveCustomTheme,
  normalizeCustomTheme,
} from '../utils/theme';
import { isTextToSpeechSupported, TTS_RATE_OPTIONS } from '../utils/tts';
import { getHolyDayWindow, HOLY_DAY_OPTIONS } from '../utils/holyDays';
import {
  getWordsOfChristSegments,
  hasWordsOfChristVerse,
  supportsPreciseWordsOfChrist,
} from '../utils/redLetters';
import {
  clearAllAppData,
  exportAppDataSnapshot,
  importAppDataSnapshot,
} from '../utils/appData';
import '../styles/settings.css';
import '../styles/translations.css';

const PREVIEW_DEFAULT = {
  bookId: 'JHN',
  chapter: 3,
  verse: 16,
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
const HOLY_DAY_REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
const HOLY_DAY_DATE_LOOKAHEAD_DAYS = 400;
const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'reader', label: 'Reader' },
  { id: 'library', label: 'Library' },
  { id: 'holy-days', label: 'Holy Days' },
];

function formatPreviewReference(bookId, chapter, verse) {
  return `${getBookById(bookId)?.name || bookId} ${chapter}:${verse}`;
}

export default function Settings() {
  const navigate = useNavigate();
  const importFileRef = useRef(null);
  const [settings, setSettings] = useState(getSettings);
  const [profile, setProfile] = useState(getProfile);
  const [nameInput, setNameInput] = useState(() => getProfile().name || '');
  const [activeTab, setActiveTab] = useState('profile');
  const [dataMessage, setDataMessage] = useState('');
  const [dataError, setDataError] = useState('');
  const [isImportingData, setIsImportingData] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);
  const [downloadedCollections, setDownloadedCollections] = useState([]);
  const [booksInstallState, setBooksInstallState] = useState(() => getBooksInstallQueueSnapshot());
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
  const textToSpeechSupported = isTextToSpeechSupported();
  const previewVerseSegments =
    settings.showWordsOfChristInRed && selectedPreviewVerse
      ? getWordsOfChristSegments({
          translationId: previewTranslationId,
          bookId: previewBookId,
          chapter: previewChapter,
          verse: selectedPreviewVerse.verse,
          text: selectedPreviewVerse.text,
          allowVerseFallback: settings.useVerseRedLetterFallback,
        })
      : null;
  const previewSupportsPreciseWordsOfChrist =
    previewTranslationId && supportsPreciseWordsOfChrist(previewTranslationId);
  const previewHasWordsOfChristVerse =
    selectedPreviewVerse &&
    hasWordsOfChristVerse(previewBookId, previewChapter, selectedPreviewVerse.verse);

  const holidayDayLabels = useMemo(() => {
    if (!settings.enableHolyDayAwareness) {
      return {};
    }

    const holyDayWindow = getHolyDayWindow(new Date(), {
      bannerWindowDays: HOLY_DAY_DATE_LOOKAHEAD_DAYS,
      daysForward: HOLY_DAY_DATE_LOOKAHEAD_DAYS,
      preferences: settings.holyDayPreferences,
    });

    return holyDayWindow.week.reduce((acc, occurrence) => {
      if (!acc[occurrence.id]) {
        acc[occurrence.id] = occurrence.shortRangeLabel || occurrence.rangeLabel;
      }

      return acc;
    }, {});
  }, [settings.enableHolyDayAwareness, settings.holyDayPreferences]);

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
    let cancelled = false;

    async function loadDownloadedCollections() {
      const collections = await getAllDownloadedLibraryCollections({ includeIncomplete: true });
      if (!cancelled) {
        setDownloadedCollections(collections);
      }
    }

    loadDownloadedCollections();
    const unsubscribe = subscribeToBooksInstallEvents((event) => {
      setBooksInstallState(event.snapshot);
      if (event.type !== 'progress' && event.type !== 'queued') {
        loadDownloadedCollections();
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

  function getBooksCollectionMeta(collectionId) {
    return downloadedCollections.find((collection) => collection.id === collectionId) || null;
  }

  function getBooksCollectionTarget(collectionId) {
    const lastBooksRead = getLastBooksRead();
    if (lastBooksRead?.collectionId === collectionId && lastBooksRead?.workId) {
      return `/books/${collectionId}/${lastBooksRead.workId}/${lastBooksRead.chapter || 1}`;
    }

    return getBooksCollectionDefaultRoute(collectionId);
  }

  function getBooksInstallActionLabel(status) {
    if (status.isQueued || status.isInstalling || !booksInstallState.activeCollectionId) {
      return status.actionLabel;
    }

    return status.isPartial ? 'Queue resume' : 'Queue save';
  }

  function handleBooksDownload(collectionId) {
    void queueBooksCollectionInstall(collectionId).catch((error) => {
      if (error.message !== 'Download cancelled') {
        console.error('Books download error:', error);
      }
    });
  }

  async function handleRemoveBooksCollection(collectionId) {
    if (!confirm('Remove this collection from offline storage?')) return;
    await removeBooksCollection(collectionId);
    setDownloadedCollections(
      await getAllDownloadedLibraryCollections({ includeIncomplete: true })
    );
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

  function updateHolyDayPreference(holidayId, key, value) {
    const updated = {
      ...settings,
      holyDayPreferences: {
        ...settings.holyDayPreferences,
        [holidayId]: {
          ...settings.holyDayPreferences[holidayId],
          [key]: value,
        },
      },
    };

    if (key === 'enabled' && !value) {
      updated.holyDayPreferences[holidayId].remindersEnabled = false;
    }

    setSettings(updated);
    saveSettings(updated);
  }

  function handleSaveName() {
    const updatedProfile = { ...profile, name: nameInput.trim() };
    setProfile(updatedProfile);
    saveProfile(updatedProfile);
    setDataMessage('Profile name saved.');
    setDataError('');
  }

  async function handleExportData() {
    try {
      const snapshot = await exportAppDataSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `yeshua-data-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setDataMessage('Data export created.');
      setDataError('');
    } catch (error) {
      setDataError(error.message || 'Unable to export data.');
      setDataMessage('');
    }
  }

  function handleImportButtonClick() {
    importFileRef.current?.click();
  }

  async function handleImportData(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    setIsImportingData(true);
    setDataMessage('');
    setDataError('');

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      await importAppDataSnapshot(snapshot);
      setDataMessage('Data import complete. Reloading the app.');
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setDataError(error.message || 'Unable to import this file.');
    } finally {
      event.target.value = '';
      setIsImportingData(false);
    }
  }

  async function handleDeleteAllData() {
    if (!confirm('Delete all Yeshua data from this device? This removes notes, downloads, settings, and profile data.')) {
      return;
    }

    setIsDeletingData(true);
    setDataMessage('');
    setDataError('');

    try {
      await clearAllAppData();
      setDataMessage('All local data removed. Reloading the app.');
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setDataError(error.message || 'Unable to delete app data.');
      setIsDeletingData(false);
    }
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
      <input
        ref={importFileRef}
        type="file"
        accept="application/json"
        className="settings-import-input"
        onChange={handleImportData}
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-sections">
        {activeTab === 'profile' && (
        <section className="settings-section">
          <p className="section-label">Profile</p>
          <div className="card settings-card-group">
            <div className="setting-row setting-row-stack">
              <div className="setting-label">
                <User size={18} />
                <span>Name</span>
              </div>
              <div className="settings-name-field">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveName();
                    }
                  }}
                  placeholder="Your name"
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveName}>
                  Save
                </button>
              </div>
              <p className="settings-help">Used for the welcome message on the home screen.</p>
            </div>

            <div className="setting-divider" />

            <div className="setting-row setting-row-stack">
              <div className="setting-label">
                <FolderDown size={18} />
                <span>Data</span>
              </div>
              <p className="settings-help">
                Import a saved Yeshua backup, export the current device state, or remove all local
                app data.
              </p>
              <div className="settings-data-actions">
                <button className="btn btn-outline btn-sm" onClick={handleExportData}>
                  <FolderDown size={14} />
                  Export Data
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleImportButtonClick}
                  disabled={isImportingData}
                >
                  <Upload size={14} />
                  {isImportingData ? 'Importing...' : 'Import Data'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteAllData}
                  disabled={isDeletingData}
                >
                  <Trash2 size={14} />
                  {isDeletingData ? 'Deleting...' : 'Delete All Data'}
                </button>
              </div>
              {dataMessage && <p className="settings-help">{dataMessage}</p>}
              {dataError && <p className="settings-help error">{dataError}</p>}
            </div>
          </div>
        </section>
        )}

        {activeTab === 'reader' && (
        <>
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

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Search size={18} />
                <span>Show Global Search Bar</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showGlobalSearchBar}
                  onChange={(e) => update('showGlobalSearchBar', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>
        </>
        )}

        {activeTab === 'library' && (
        <section className="settings-section">
          <p className="section-label">Library</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <BookOpen size={18} />
                <span>Show Library Tab</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showBooksTab}
                  onChange={(e) => update('showBooksTab', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="settings-help">
              Adds a Library tab for Bible-adjacent collections with separate install state for the
              full Qur&apos;an and the wider Apocrypha shelf, plus linked Baha&apos;i and
              Zoroastrian libraries.
            </p>

            <div className="setting-divider" />

            <div className="setting-row setting-row-stack">
              <div className="setting-label">
                <Globe size={18} />
                <span>Library Collection Storage</span>
              </div>
              <p className="settings-help">
                Reader collections keep their own queue, cache, and remove controls separate from
                Bible translation installs, but follow the same offline-first pattern.
              </p>

              <div className="settings-library-list">
                {BOOKS_TAB_COLLECTIONS.map((collection) => {
                  const meta = getBooksCollectionMeta(collection.id);
                  const queueJob = booksInstallState.jobs[collection.id] || null;
                  const status = getBooksCollectionStatus(collection, meta, queueJob);
                  const stats = getBooksCollectionStats(collection.id, meta?.works);
                  const progressDone =
                    queueJob?.phase === 'active'
                      ? queueJob.progress.done
                      : meta?.completedChapters ?? 0;
                  const progressTotal =
                    queueJob?.phase === 'active'
                      ? queueJob.progress.total
                      : meta?.totalChapters ?? 0;
                  const isActive = queueJob?.phase === 'active';
                  const isInProgress = isActive || status.isInstalling;
                  const isBibleReady = downloadedTranslations.length > 0;
                  const primaryExternalHref = collection.works?.[0]?.href || null;

                  return (
                    <div
                      key={collection.id}
                      className={`card translation-card ${
                        status.canOpenReader || status.isSavedOnDevice ? 'downloaded' : ''
                      }`}
                    >
                      <div className="translation-info">
                        <div className="translation-header">
                          <h3>{collection.name}</h3>
                          <span className="chip">
                            <Globe size={12} />
                            {collection.tradition}
                          </span>
                        </div>
                        <p className="translation-abbr">
                          {collection.kind === 'reader'
                            ? `${stats.workCount} works • ${stats.totalChapters} chapters`
                            : collection.kind === 'bible'
                              ? isBibleReady
                                ? 'Bible translations ready'
                                : 'Uses Bible translation installs'
                              : collection.sourceLabel}
                        </p>
                        <p className="translation-desc">{collection.description}</p>

                        <div className="translation-badges">
                          {status.badgeLabels.map((badge) => (
                            <span
                              key={badge}
                              className={`chip translation-chip translation-chip-${status.tone}`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>

                        {!isInProgress && (
                          <div className={`translation-status translation-status-${status.tone}`}>
                            <span>{status.statusLabel}</span>
                          </div>
                        )}
                        <p className="translation-detail">{status.detailLabel}</p>

                        {isInProgress && (
                          <div className="download-progress">
                            <div className="progress-bar">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${progressTotal ? (progressDone / progressTotal) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="progress-text">
                              {progressDone} / {progressTotal} chapters
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="translation-actions">
                        {collection.kind === 'bible' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate('/read')}
                            >
                              <BookOpen size={14} />
                              Open Reader
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/translations')}
                            >
                              <Download size={14} />
                              Manage Translations
                            </button>
                          </>
                        ) : collection.kind === 'reader' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate(getBooksCollectionTarget(collection.id))}
                            >
                              <BookOpen size={14} />
                              Open
                            </button>

                            {isActive ? (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => cancelBooksCollectionInstall(collection.id)}
                              >
                                Cancel
                              </button>
                            ) : status.isQueued ? (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => cancelBooksCollectionInstall(collection.id)}
                              >
                                Remove from Queue
                              </button>
                            ) : status.isSavedOnDevice ? (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRemoveBooksCollection(collection.id)}
                              >
                                <Trash2 size={14} />
                                {status.removeLabel}
                              </button>
                            ) : status.isPartial ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleBooksDownload(collection.id)}
                                  disabled={!status.canInstall}
                                >
                                  <Download size={14} />
                                  {getBooksInstallActionLabel(status)}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleRemoveBooksCollection(collection.id)}
                                >
                                  <Trash2 size={14} />
                                  Clear
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleBooksDownload(collection.id)}
                                disabled={!status.canInstall}
                              >
                                <Download size={14} />
                                {getBooksInstallActionLabel(status)}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate('/books')}
                            >
                              <BookOpen size={14} />
                              Browse in Library
                            </button>
                            {primaryExternalHref && (
                              <a
                                className="btn btn-primary btn-sm"
                                href={primaryExternalHref}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink size={14} />
                                Open Source
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        )}

        {activeTab === 'reader' && (
        <>
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
                <Palette size={18} />
                <span>Words of Christ in Red</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showWordsOfChristInRed}
                  onChange={(e) => update('showWordsOfChristInRed', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row setting-row-color">
              <div className="setting-label">
                <Palette size={18} />
                <span>Words of Christ color</span>
              </div>
              <input
                type="color"
                value={settings.wordsOfChristColor}
                disabled={!settings.showWordsOfChristInRed}
                onChange={(e) => update('wordsOfChristColor', e.target.value)}
              />
            </div>

            <p className="settings-help">
              KJV uses word-level red-letter data for precise Christ-word highlighting.
            </p>

            <div className="setting-row">
              <div className="setting-label">
                <Palette size={18} />
                <span>Use Verse Matches for All Translations</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.useVerseRedLetterFallback}
                  disabled={!settings.showWordsOfChristInRed}
                  onChange={(e) => update('useVerseRedLetterFallback', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="settings-help">
              Colors any verse that matches the KJV red-letter verse map, even when the current
              translation does not have word-level markup.
            </p>

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

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Volume2 size={18} />
                <span>Text to Speech Tool</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showTextToSpeechTool}
                  onChange={(e) => update('showTextToSpeechTool', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Volume2 size={18} />
                <span>Text to Speech Speed</span>
              </div>
              <select
                value={settings.textToSpeechRate}
                onChange={(e) => update('textToSpeechRate', Number.parseFloat(e.target.value))}
                disabled={!settings.showTextToSpeechTool || !textToSpeechSupported}
              >
                {TTS_RATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <p className={`settings-help ${textToSpeechSupported ? '' : 'error'}`}>
              {textToSpeechSupported
                ? settings.showTextToSpeechTool
                  ? 'Uses your device voice to read the current chapter aloud from the reader tools menu.'
                  : 'Turn this on to show a read-aloud control in the reader tools menu.'
                : 'This browser does not support text to speech right now.'}
            </p>
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
              {settings.showWordsOfChristInRed &&
                !settings.useVerseRedLetterFallback &&
                !previewSupportsPreciseWordsOfChrist && (
                <span className="settings-help">
                  Red-letter preview is available when the preview translation is KJV.
                </span>
              )}
              {settings.showWordsOfChristInRed &&
                settings.useVerseRedLetterFallback &&
                !previewSupportsPreciseWordsOfChrist &&
                previewHasWordsOfChristVerse && (
                  <span className="settings-help">
                    This preview is using verse-level red-letter matching from the KJV verse map.
                  </span>
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
                  {previewVerseSegments
                    ? previewVerseSegments.map((segment, index) => (
                        <span
                          key={`${selectedPreviewVerse.verse}-${index}`}
                          className={segment.isRed ? 'verse-christ-words' : undefined}
                        >
                          {segment.text}
                        </span>
                      ))
                    : selectedPreviewVerse.text}
                </>
              ) : (
                <p className="settings-help">No verse available for this selection.</p>
              )}
            </div>
          </div>
        </section>
        </>
        )}

        {activeTab === 'holy-days' && (
        <section className="settings-section">
          <p className="section-label">Holy Days</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <CalendarDays size={18} />
                <span>Enable Holy Day Awareness</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enableHolyDayAwareness}
                  onChange={(e) => update('enableHolyDayAwareness', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Bell size={18} />
                <span>Reminder Lead Time</span>
              </div>
              <select
                value={settings.holyDayReminderLeadDays}
                onChange={(e) => update('holyDayReminderLeadDays', Number.parseInt(e.target.value, 10))}
                disabled={!settings.enableHolyDayAwareness}
              >
                {HOLY_DAY_REMINDER_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0 ? 'Same day only' : `${days} day${days === 1 ? '' : 's'} before`}
                  </option>
                ))}
              </select>
            </div>

            <p className="settings-help">
              Hidden observances stay out of banners and reminders. Silent observances still appear
              in the holiday manager but will not trigger reminder toasts.
            </p>

            <div className="setting-divider" />

            {settings.enableHolyDayAwareness ? (
              <div className="holy-day-settings-list">
                {HOLY_DAY_OPTIONS.map((holiday) => {
                  const preference = settings.holyDayPreferences[holiday.id];
                  const dayLabel = holidayDayLabels[holiday.id];

                  return (
                    <div key={holiday.id} className="holy-day-setting-item">
                      <div className="holy-day-setting-copy">
                        <strong>{holiday.name}</strong>
                        <span>{holiday.isHighHolyDay ? 'High holy day' : 'Optional observance'}</span>
                      </div>

                      <div className="holy-day-setting-controls">
                        <div className="holy-day-setting-toggle">
                          <span>Shown</span>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={preference?.enabled !== false}
                              disabled={!settings.enableHolyDayAwareness}
                              onChange={(e) =>
                                updateHolyDayPreference(holiday.id, 'enabled', e.target.checked)
                              }
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>

                        <div className="holy-day-setting-toggle">
                          <span>Alert</span>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(preference?.remindersEnabled)}
                              disabled={!settings.enableHolyDayAwareness || preference?.enabled === false}
                              onChange={(e) =>
                                updateHolyDayPreference(holiday.id, 'remindersEnabled', e.target.checked)
                              }
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>

                      {dayLabel && <p className="holy-day-setting-day-label">{dayLabel}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="holy-day-settings-collapsed-note">
                Holy day awareness is disabled, so the holiday list is folded. Enable it to manage
                individual observances.
              </p>
            )}
          </div>
        </section>
        )}

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
