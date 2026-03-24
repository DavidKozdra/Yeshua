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
  Trash2,
  User,
  Upload,
  FolderDown,
} from 'lucide-react';
import { getProfile, getSettings, saveProfile, saveSettings } from '../utils/storage';
import {
  AVAILABLE_TRANSLATIONS,
  BIBLE_BOOKS,
  getBookById,
  getTranslationById,
} from '../utils/bibleData';
import { getAllDownloadedTranslations } from '../utils/db';
import { fetchChapter, subscribeToTranslationInstallEvents } from '../utils/api';
import { getTranslationSelectLabel, getTranslationStatus } from '../utils/translationStatus';
import { parseReferenceInput } from '../utils/reference';
import {
  analyzeCustomTheme,
  applyTheme,
  BUILT_IN_THEMES,
  COLOR_VISION_MODES,
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
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  areBrowserNotificationsSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../utils/notifications';
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
  cool: 'Cool',
};
const HOLY_DAY_REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
const HOLY_DAY_DATE_LOOKAHEAD_DAYS = 400;
const COLOR_VISION_OPTIONS = [
  {
    value: 'default',
    label: 'Default Colors',
    description: 'Keep the app palette unchanged.',
  },
  {
    value: 'deuteranopia',
    label: 'Deuteranopia Assist',
    description: 'Shifts red and green states farther apart for green-weak vision.',
  },
  {
    value: 'protanopia',
    label: 'Protanopia Assist',
    description: 'Adjusts warm hues that often blur together for red-weak vision.',
  },
  {
    value: 'tritanopia',
    label: 'Tritanopia Assist',
    description: 'Makes blue-yellow differences clearer.',
  },
];
const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'reader', label: 'Reader', icon: BookOpen },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
  { id: 'notifications', label: 'Notifications', icon: Bell },
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
  const [showThemeModal, setShowThemeModal] = useState(false);
  const themeModalRef = useFocusTrap(showThemeModal);
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
  const [notificationPermission, setNotificationPermission] = useState(() =>
    getBrowserNotificationPermission()
  );

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
    function syncNotificationPermission() {
      setNotificationPermission(getBrowserNotificationPermission());
    }

    syncNotificationPermission();
    window.addEventListener('focus', syncNotificationPermission);

    return () => {
      window.removeEventListener('focus', syncNotificationPermission);
    };
  }, []);

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

  async function handleEnableBrowserNotifications() {
    if (!areBrowserNotificationsSupported()) {
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);

    update('enableBrowserNotifications', permission === 'granted');
  }

  async function handleSendTestNotification() {
    const sent = await showBrowserNotification({
      title: 'Yeshua notifications are on',
      body: 'Holy day reminders can now appear as browser notifications on this device.',
      tag: 'yeshua-notification-test',
    });

    if (!sent) {
      setDataError('Browser notifications are not available right now.');
      return;
    }

    setDataError('');
    setDataMessage('Test notification sent.');
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

  function handleDeleteCustomTheme(themeId) {
    const themeToDelete = settings.customThemes.find((theme) => theme.id === themeId);
    if (!themeToDelete) return false;

    const confirmed = confirm(
      `Remove the "${themeToDelete.name}" custom theme? This cannot be undone.`
    );
    if (!confirmed) {
      return false;
    }

    const remainingThemes = settings.customThemes.filter((theme) => theme.id !== themeId);
    const wasActive = settings.theme === themeId;
    const updated = {
      ...settings,
      theme: wasActive ? BUILT_IN_THEMES[0] : settings.theme,
      customTheme: wasActive ? CUSTOM_THEME_DEFAULT : settings.customTheme,
      customThemes: remainingThemes,
    };

    setSettings(updated);
    saveSettings(updated);
    return true;
  }

  function handleDeleteThemeFromModal() {
    if (!editingThemeId) return;
    const deleted = handleDeleteCustomTheme(editingThemeId);
    if (deleted) {
      setShowThemeModal(false);
      setEditingThemeId(null);
      setThemeDraftName('');
      setThemeDraft(normalizeCustomTheme(CUSTOM_THEME_DEFAULT));
      setThemeNameError('');
    }
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
  const themeDraftAnalysis = useMemo(() => analyzeCustomTheme(themeDraft), [themeDraft]);

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <input
        ref={importFileRef}
        type="file"
        accept="application/json"
        className="settings-import-input"
        aria-label="Import Yeshua data backup"
        onChange={handleImportData}
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-sections" role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
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
                  id="profile-name"
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
                  aria-label="Profile name"
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
              {dataMessage && <p className="settings-help" role="status" aria-live="polite">{dataMessage}</p>}
              {dataError && <p className="settings-help error" role="alert">{dataError}</p>}
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

        {activeTab === 'accessibility' && (
        <>
        <section className="settings-section">
          <p className="section-label">Motion</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <Sun size={18} />
                <span>Enable Animations</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enableAnimations}
                  onChange={(e) => update('enableAnimations', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="settings-help">
              Controls entrance motion, hover movement, and decorative interface transitions across
              the app.
            </p>
          </div>
        </section>

        <section className="settings-section">
          <p className="section-label">Accessibility</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <Eye size={18} />
                <span>Enhanced Focus Indicators</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enhancedFocusIndicators}
                  onChange={(e) => update('enhancedFocusIndicators', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Type size={18} />
                <span>Underline Links</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.underlineLinks}
                  onChange={(e) => update('underlineLinks', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <BookOpen size={18} />
                <span>Larger Touch Targets</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.largeTouchTargets}
                  onChange={(e) => update('largeTouchTargets', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row setting-row-stack">
              <div className="setting-label">
                <Palette size={18} />
                <span>Color Vision Support</span>
              </div>
              <select
                value={COLOR_VISION_MODES.includes(settings.colorVisionMode) ? settings.colorVisionMode : 'default'}
                aria-label="Color vision support"
                onChange={(e) => update('colorVisionMode', e.target.value)}
              >
                {COLOR_VISION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="settings-help">
                {
                  COLOR_VISION_OPTIONS.find((option) => option.value === settings.colorVisionMode)
                    ?.description
                }
              </p>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Eye size={18} />
                <span>High Contrast Text</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.highContrastText}
                  onChange={(e) => update('highContrastText', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Type size={18} />
                <span>Extra Letter Spacing</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.increasedLetterSpacing}
                  onChange={(e) => update('increasedLetterSpacing', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Type size={18} />
                <span>Extra Word Spacing</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.increasedWordSpacing}
                  onChange={(e) => update('increasedWordSpacing', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="settings-help">
              Adds stronger keyboard focus outlines, optional link underlines, and roomier buttons
              and controls for easier tapping. You can also increase text contrast and add spacing
              between letters and words for easier scanning. Color vision support remaps status
              colors for different forms of color blindness.
            </p>
          </div>
        </section>
        </>
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
              <div className="font-size-control" role="group" aria-label="Font size controls">
                <button
                  className="btn btn-outline btn-sm"
                  aria-label="Decrease font size"
                  onClick={() => update('fontSize', Math.max(14, settings.fontSize - 1))}
                >
                  A-
                </button>
                <span className="font-size-value" aria-live="polite">{settings.fontSize}px</span>
                <button
                  className="btn btn-outline btn-sm"
                  aria-label="Increase font size"
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
                aria-label="Line height"
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
                aria-label="Words of Christ color"
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
                aria-label="Text to speech speed"
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

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Volume2 size={18} />
                <span>Announce chapter numbers</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.announceChapterNumbers}
                  disabled={!settings.showTextToSpeechTool || !textToSpeechSupported}
                  onChange={(e) => update('announceChapterNumbers', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <Volume2 size={18} />
                <span>Announce verse numbers</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.announceVerseNumbers}
                  disabled={!settings.showTextToSpeechTool || !textToSpeechSupported}
                  onChange={(e) => update('announceVerseNumbers', e.target.checked)}
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
                aria-label="Default translation"
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
                  aria-label="Preview verse reference"
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
                aria-label="Preview book"
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
                aria-label="Preview chapter"
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
                aria-label="Preview verse"
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

        {activeTab === 'notifications' && (
        <>
        <section className="settings-section">
          <p className="section-label">Notifications</p>
          <div className="card settings-card-group">
            <div className="setting-row">
              <div className="setting-label">
                <Bell size={18} />
                <span>Enable Browser Notifications</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enableBrowserNotifications}
                  disabled={!areBrowserNotificationsSupported() || notificationPermission !== 'granted'}
                  onChange={(e) => update('enableBrowserNotifications', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className={`settings-help ${!areBrowserNotificationsSupported() ? 'error' : ''}`}>
              {!areBrowserNotificationsSupported()
                ? 'This browser does not support notifications.'
                : notificationPermission === 'granted'
                  ? 'Browser notifications are allowed. Reminders can appear outside the app while it is open.'
                  : notificationPermission === 'denied'
                    ? 'Browser notifications are blocked in this browser. Re-enable them in browser site settings to use them here.'
                    : 'Allow browser notifications to enable reminder alerts beyond in-app toasts.'}
            </p>

            <div className="theme-actions">
              {notificationPermission !== 'granted' && areBrowserNotificationsSupported() && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleEnableBrowserNotifications}
                >
                  <Bell size={14} />
                  Allow Notifications
                </button>
              )}

              {notificationPermission === 'granted' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSendTestNotification}
                >
                  <Bell size={14} />
                  Send Test Notification
                </button>
              )}
            </div>

            <div className="setting-divider" />

            <div className="setting-row">
              <div className="setting-label">
                <Bell size={18} />
                <span>Weekly Reading Reminders</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enableWeeklyReadingReminders}
                  onChange={(e) => update('enableWeeklyReadingReminders', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <p className="settings-help">
              Sends a weekly reminder when Yeshua has not been opened for about 7 days. If browser
              notifications are off or unavailable, the reminder falls back to an in-app toast when
              you return.
            </p>

            <div className="setting-divider" />

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
                <span>Holy Day Reminder Lead Time</span>
              </div>
              <select
                value={settings.holyDayReminderLeadDays}
                aria-label="Reminder lead time"
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
        </>
        )}

        <p className="settings-footer">
          Yeshua Bible Reader &middot; All data stored locally on your device.
        </p>
      </div>

      {showThemeModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowThemeModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowThemeModal(false); }}
        >
          <div
            className="modal theme-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingThemeId ? 'Edit Custom Theme' : 'Create Custom Theme'}
            ref={themeModalRef}
            onClick={(e) => e.stopPropagation()}
          >
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

            {themeDraftAnalysis.hasIssues && (
              <div
                className={`theme-warning-banner ${
                  themeDraftAnalysis.hasHighSeverityIssues ? 'is-critical' : ''
                }`}
                role="alert"
              >
                <strong>
                  {themeDraftAnalysis.hasHighSeverityIssues
                    ? 'Accessibility warning'
                    : 'Accessibility review'}
                </strong>
                <p>
                  This custom theme has readability or color-vision risks that may make text and
                  status states harder to distinguish.
                </p>
                <ul className="theme-warning-list">
                  {themeDraftAnalysis.issues.map((issue) => (
                    <li key={issue.id}>
                      <span className={`theme-warning-pill ${issue.severity}`}>
                        {issue.severity === 'high' ? 'High' : 'Watch'}
                      </span>
                      <span>
                        {issue.title}. {issue.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              {editingThemeId && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteThemeFromModal}
                >
                  Delete Theme
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setThemeDraft({ ...CUSTOM_THEME_DEFAULT })}
              >
                Reset
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowThemeModal(false)}>
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
