import {
  COLOR_VISION_MODES,
  CUSTOM_THEME_DEFAULT,
  DEFAULT_CUSTOM_THEME_NAME,
  createCustomThemeId,
  getCustomThemeById,
  getSystemThemePreference,
  isBuiltInTheme,
  normalizeCustomTheme,
  normalizeCustomThemes,
} from './theme';
import { DEFAULT_TRANSLATION_ID } from './translationConfig';
import { getTranslationById } from './bibleData';
import { HOLY_DAY_OPTIONS } from './holyDays';
import { TTS_RATE_OPTIONS } from './tts';
import {
  DEFAULT_WORDS_OF_CHRIST_COLOR,
  sanitizeWordsOfChristColor,
} from './wordsOfChrist';

const SETTINGS_KEY = 'yeshua-settings';
const LAST_READ_KEY = 'yeshua-last-read';
const LAST_BOOKS_READ_KEY = 'yeshua-last-books-read';
const LAST_APP_OPENED_AT_KEY = 'yeshua-last-app-opened-at';
const PROFILE_KEY = 'yeshua-profile';
const HOLY_DAY_REMINDER_KEY = 'yeshua-holy-day-reminders';
const SETTINGS_EVENT = 'yeshua-settings-changed';
const VALID_TTS_RATES = new Set(TTS_RATE_OPTIONS.map((option) => option.value));
const DEFAULT_HOLY_DAY_REMINDER_LEAD_DAYS = 2;
const DEFAULT_THEME = getSystemThemePreference();

const defaults = {
  fontSize: 16,
  lineHeight: 1.6,
  theme: DEFAULT_THEME,
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  enableAnimations: true,
  enhancedFocusIndicators: true,
  underlineLinks: false,
  largeTouchTargets: false,
  highContrastText: false,
  increasedLetterSpacing: false,
  increasedWordSpacing: false,
  colorVisionMode: 'default',
  enableBrowserNotifications: false,
  enableWeeklyReadingReminders: false,
  showVerseNumbers: true,
  showWordsOfChristInRed: false,
  useVerseRedLetterFallback: false,
  oneVersePerLine: true,
  showGlobalSearchBar: true,
  enableHolyDayAwareness: true,
  holyDayReminderLeadDays: DEFAULT_HOLY_DAY_REMINDER_LEAD_DAYS,
  holyDayPreferences: Object.fromEntries(
    HOLY_DAY_OPTIONS.map((holiday) => [
      holiday.id,
      {
        enabled: true,
        remindersEnabled: holiday.isHighHolyDay,
      },
    ])
  ),
  showTextToSpeechTool: true,
  textToSpeechRate: 1,
  textToSpeechVoice: '',
  announceChapterNumbers: true,
  announceVerseNumbers: true,
  customTheme: CUSTOM_THEME_DEFAULT,
  customThemes: [],
  wordsOfChristColor: DEFAULT_WORDS_OF_CHRIST_COLOR,
};

function normalizeTextToSpeechRate(value) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  return VALID_TTS_RATES.has(parsedValue) ? parsedValue : defaults.textToSpeechRate;
}

function normalizeHolyDayReminderLeadDays(value) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 14
    ? parsedValue
    : DEFAULT_HOLY_DAY_REMINDER_LEAD_DAYS;
}

function normalizeHolyDayPreferences(parsedPreferences = {}) {
  return Object.fromEntries(
    HOLY_DAY_OPTIONS.map((holiday) => {
      const holidayPreference = parsedPreferences[holiday.id];

      return [
        holiday.id,
        {
          enabled:
            typeof holidayPreference?.enabled === 'boolean'
              ? holidayPreference.enabled
              : true,
          remindersEnabled:
            typeof holidayPreference?.remindersEnabled === 'boolean'
              ? holidayPreference.remindersEnabled
              : holiday.isHighHolyDay,
        },
      ];
    })
  );
}

function normalizeColorVisionMode(value) {
  return COLOR_VISION_MODES.includes(value) ? value : defaults.colorVisionMode;
}

const BOOLEAN_SETTING_KEYS = [
  'enableAnimations',
  'enhancedFocusIndicators',
  'underlineLinks',
  'largeTouchTargets',
  'highContrastText',
  'increasedLetterSpacing',
  'increasedWordSpacing',
  'enableBrowserNotifications',
  'enableWeeklyReadingReminders',
  'showWordsOfChristInRed',
  'useVerseRedLetterFallback',
  'enableHolyDayAwareness',
  'showTextToSpeechTool',
  'announceChapterNumbers',
  'announceVerseNumbers',
];

function normalizeBooleans(source) {
  const result = {};
  for (const key of BOOLEAN_SETTING_KEYS) {
    result[key] = typeof source[key] === 'boolean' ? source[key] : defaults[key];
  }
  return result;
}

function resolveTheme(parsedSettings, normalizedCustomTheme) {
  let customThemes = normalizeCustomThemes(parsedSettings.customThemes);
  let theme = typeof parsedSettings.theme === 'string' ? parsedSettings.theme : DEFAULT_THEME;

  if (theme === 'custom') {
    const migratedTheme = {
      id: createCustomThemeId(DEFAULT_CUSTOM_THEME_NAME, customThemes),
      name: DEFAULT_CUSTOM_THEME_NAME,
      colors: normalizedCustomTheme,
    };
    customThemes = [migratedTheme, ...customThemes];
    theme = migratedTheme.id;
  }

  if (!isBuiltInTheme(theme) && !getCustomThemeById(customThemes, theme)) {
    theme = DEFAULT_THEME;
  }

  return { theme, customThemes };
}

function normalizeSettings(parsedSettings = {}) {
  const defaultTranslation = getTranslationById(parsedSettings.defaultTranslation)
    ? parsedSettings.defaultTranslation
    : DEFAULT_TRANSLATION_ID;
  const normalizedCustomTheme = normalizeCustomTheme(parsedSettings.customTheme);
  const { theme, customThemes } = resolveTheme(parsedSettings, normalizedCustomTheme);

  return {
    ...defaults,
    ...parsedSettings,
    ...normalizeBooleans(parsedSettings),
    theme,
    defaultTranslation,
    colorVisionMode: normalizeColorVisionMode(parsedSettings.colorVisionMode),
    holyDayReminderLeadDays: normalizeHolyDayReminderLeadDays(parsedSettings.holyDayReminderLeadDays),
    holyDayPreferences: normalizeHolyDayPreferences(parsedSettings.holyDayPreferences),
    textToSpeechRate: normalizeTextToSpeechRate(parsedSettings.textToSpeechRate),
    textToSpeechVoice:
      typeof parsedSettings.textToSpeechVoice === 'string'
        ? parsedSettings.textToSpeechVoice
        : defaults.textToSpeechVoice,
    customTheme: normalizedCustomTheme,
    customThemes,
    wordsOfChristColor: sanitizeWordsOfChristColor(parsedSettings.wordsOfChristColor),
  };
}

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return normalizeSettings();
    }

    return normalizeSettings(JSON.parse(stored));
  } catch {
    return normalizeSettings();
  }
}

export function saveSettings(settings) {
  const customThemes = normalizeCustomThemes(settings.customThemes);
  const activeCustomTheme = getCustomThemeById(customThemes, settings.theme);
  const storedSettings = {
    ...settings,
    ...normalizeBooleans(settings),
    theme:
      typeof settings.theme === 'string' &&
      (isBuiltInTheme(settings.theme) || activeCustomTheme)
        ? settings.theme
        : DEFAULT_THEME,
    colorVisionMode: normalizeColorVisionMode(settings.colorVisionMode),
    holyDayReminderLeadDays: normalizeHolyDayReminderLeadDays(settings.holyDayReminderLeadDays),
    holyDayPreferences: normalizeHolyDayPreferences(settings.holyDayPreferences),
    textToSpeechRate: normalizeTextToSpeechRate(settings.textToSpeechRate),
    textToSpeechVoice:
      typeof settings.textToSpeechVoice === 'string'
        ? settings.textToSpeechVoice
        : defaults.textToSpeechVoice,
    customTheme: activeCustomTheme?.colors || normalizeCustomTheme(settings.customTheme),
    customThemes,
    wordsOfChristColor: sanitizeWordsOfChristColor(settings.wordsOfChristColor),
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SETTINGS_EVENT, {
        detail: {
          settings: normalizeSettings(storedSettings),
        },
      })
    );
  }
}

export function subscribeToSettings(listener) {
  if (typeof window === 'undefined') return () => {};

  function handleSettingsChange(event) {
    listener(event.detail?.settings || getSettings());
  }

  window.addEventListener(SETTINGS_EVENT, handleSettingsChange);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, handleSettingsChange);
  };
}

export function getLastRead() {
  try {
    const stored = localStorage.getItem(LAST_READ_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveLastRead(location) {
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(location));
}

export function getLastBooksRead() {
  try {
    const stored = localStorage.getItem(LAST_BOOKS_READ_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveLastBooksRead(location) {
  localStorage.setItem(LAST_BOOKS_READ_KEY, JSON.stringify(location));
}

export function getLastAppOpenedAt() {
  try {
    return localStorage.getItem(LAST_APP_OPENED_AT_KEY) || null;
  } catch {
    return null;
  }
}

export function saveLastAppOpenedAt(value = new Date().toISOString()) {
  localStorage.setItem(LAST_APP_OPENED_AT_KEY, value);
}

export function getProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    return stored ? JSON.parse(stored) : { name: '' };
  } catch {
    return { name: '' };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function exportAppStorageData() {
  return {
    settings: getSettings(),
    lastRead: getLastRead(),
    lastBooksRead: getLastBooksRead(),
    lastAppOpenedAt: getLastAppOpenedAt(),
    profile: getProfile(),
    holyDayReminders: getHolyDayReminderStore(),
  };
}

export function importAppStorageData(snapshot = {}, options = {}) {
  const { mode = 'replace' } = options;
  const currentSettings = getSettings();
  saveSettings(mode === 'merge' ? { ...currentSettings, ...(snapshot.settings || {}) } : snapshot.settings || currentSettings);

  if (snapshot.lastRead) {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(snapshot.lastRead));
  } else if (mode !== 'merge') {
    localStorage.removeItem(LAST_READ_KEY);
  }

  if (snapshot.lastBooksRead) {
    localStorage.setItem(LAST_BOOKS_READ_KEY, JSON.stringify(snapshot.lastBooksRead));
  } else if (mode !== 'merge') {
    localStorage.removeItem(LAST_BOOKS_READ_KEY);
  }

  if (snapshot.lastAppOpenedAt) {
    localStorage.setItem(LAST_APP_OPENED_AT_KEY, snapshot.lastAppOpenedAt);
  } else if (mode !== 'merge') {
    localStorage.removeItem(LAST_APP_OPENED_AT_KEY);
  }

  saveProfile(mode === 'merge' ? { ...getProfile(), ...(snapshot.profile || {}) } : snapshot.profile || { name: '' });

  if (snapshot.holyDayReminders && typeof snapshot.holyDayReminders === 'object') {
    const reminders =
      mode === 'merge'
        ? { ...getHolyDayReminderStore(), ...snapshot.holyDayReminders }
        : snapshot.holyDayReminders;
    localStorage.setItem(HOLY_DAY_REMINDER_KEY, JSON.stringify(reminders));
  } else if (mode !== 'merge') {
    localStorage.removeItem(HOLY_DAY_REMINDER_KEY);
  }
}

export function clearAppStorageData() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(LAST_READ_KEY);
  localStorage.removeItem(LAST_BOOKS_READ_KEY);
  localStorage.removeItem(LAST_APP_OPENED_AT_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(HOLY_DAY_REMINDER_KEY);
}

function getHolyDayReminderStore() {
  try {
    const stored = localStorage.getItem(HOLY_DAY_REMINDER_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function hasSeenHolyDayReminder(reminderKey) {
  return Boolean(getHolyDayReminderStore()[reminderKey]);
}

export function markHolyDayReminderSeen(reminderKey) {
  const reminders = getHolyDayReminderStore();
  reminders[reminderKey] = new Date().toISOString();

  const trimmedEntries = Object.entries(reminders)
    .sort((left, right) => new Date(right[1]) - new Date(left[1]))
    .slice(0, 60);

  localStorage.setItem(HOLY_DAY_REMINDER_KEY, JSON.stringify(Object.fromEntries(trimmedEntries)));
}
