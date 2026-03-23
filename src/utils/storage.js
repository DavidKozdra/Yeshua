import {
  CUSTOM_THEME_DEFAULT,
  DEFAULT_CUSTOM_THEME_NAME,
  createCustomThemeId,
  getCustomThemeById,
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
const PROFILE_KEY = 'yeshua-profile';
const HOLY_DAY_REMINDER_KEY = 'yeshua-holy-day-reminders';
const SETTINGS_EVENT = 'yeshua-settings-changed';
const VALID_TTS_RATES = new Set(TTS_RATE_OPTIONS.map((option) => option.value));
const DEFAULT_HOLY_DAY_REMINDER_LEAD_DAYS = 2;

const defaults = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'dark',
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  enableAnimations: true,
  enhancedFocusIndicators: true,
  underlineLinks: false,
  largeTouchTargets: false,
  highContrastText: false,
  increasedLetterSpacing: false,
  increasedWordSpacing: false,
  showBooksTab: true,
  showVerseNumbers: true,
  showWordsOfChristInRed: false,
  useVerseRedLetterFallback: false,
  oneVersePerLine: false,
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

function normalizeSettings(parsedSettings = {}) {
  const defaultTranslation = getTranslationById(parsedSettings.defaultTranslation)
    ? parsedSettings.defaultTranslation
    : DEFAULT_TRANSLATION_ID;
  const normalizedCustomTheme = normalizeCustomTheme(parsedSettings.customTheme);
  const normalizedHolyDayPreferences = normalizeHolyDayPreferences(parsedSettings.holyDayPreferences);
  let customThemes = normalizeCustomThemes(parsedSettings.customThemes);
  let theme = typeof parsedSettings.theme === 'string' ? parsedSettings.theme : defaults.theme;

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
    theme = defaults.theme;
  }

  return {
    ...defaults,
    ...parsedSettings,
    theme,
    defaultTranslation,
    enableAnimations:
      typeof parsedSettings.enableAnimations === 'boolean'
        ? parsedSettings.enableAnimations
        : defaults.enableAnimations,
    enhancedFocusIndicators:
      typeof parsedSettings.enhancedFocusIndicators === 'boolean'
        ? parsedSettings.enhancedFocusIndicators
        : defaults.enhancedFocusIndicators,
    underlineLinks:
      typeof parsedSettings.underlineLinks === 'boolean'
        ? parsedSettings.underlineLinks
        : defaults.underlineLinks,
    largeTouchTargets:
      typeof parsedSettings.largeTouchTargets === 'boolean'
        ? parsedSettings.largeTouchTargets
        : defaults.largeTouchTargets,
    highContrastText:
      typeof parsedSettings.highContrastText === 'boolean'
        ? parsedSettings.highContrastText
        : defaults.highContrastText,
    increasedLetterSpacing:
      typeof parsedSettings.increasedLetterSpacing === 'boolean'
        ? parsedSettings.increasedLetterSpacing
        : defaults.increasedLetterSpacing,
    increasedWordSpacing:
      typeof parsedSettings.increasedWordSpacing === 'boolean'
        ? parsedSettings.increasedWordSpacing
        : defaults.increasedWordSpacing,
    showBooksTab:
      typeof parsedSettings.showBooksTab === 'boolean'
        ? parsedSettings.showBooksTab
        : defaults.showBooksTab,
    showWordsOfChristInRed:
      typeof parsedSettings.showWordsOfChristInRed === 'boolean'
        ? parsedSettings.showWordsOfChristInRed
        : defaults.showWordsOfChristInRed,
    useVerseRedLetterFallback:
      typeof parsedSettings.useVerseRedLetterFallback === 'boolean'
        ? parsedSettings.useVerseRedLetterFallback
        : defaults.useVerseRedLetterFallback,
    enableHolyDayAwareness:
      typeof parsedSettings.enableHolyDayAwareness === 'boolean'
        ? parsedSettings.enableHolyDayAwareness
        : defaults.enableHolyDayAwareness,
    holyDayReminderLeadDays: normalizeHolyDayReminderLeadDays(parsedSettings.holyDayReminderLeadDays),
    holyDayPreferences: normalizedHolyDayPreferences,
    showTextToSpeechTool:
      typeof parsedSettings.showTextToSpeechTool === 'boolean'
        ? parsedSettings.showTextToSpeechTool
        : defaults.showTextToSpeechTool,
    textToSpeechRate: normalizeTextToSpeechRate(parsedSettings.textToSpeechRate),
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
  const normalizedHolyDayPreferences = normalizeHolyDayPreferences(settings.holyDayPreferences);
  const storedSettings = {
    ...settings,
    theme:
      typeof settings.theme === 'string' &&
      (isBuiltInTheme(settings.theme) || activeCustomTheme)
        ? settings.theme
        : defaults.theme,
    enableAnimations:
      typeof settings.enableAnimations === 'boolean'
        ? settings.enableAnimations
        : defaults.enableAnimations,
    enhancedFocusIndicators:
      typeof settings.enhancedFocusIndicators === 'boolean'
        ? settings.enhancedFocusIndicators
        : defaults.enhancedFocusIndicators,
    underlineLinks:
      typeof settings.underlineLinks === 'boolean'
        ? settings.underlineLinks
        : defaults.underlineLinks,
    largeTouchTargets:
      typeof settings.largeTouchTargets === 'boolean'
        ? settings.largeTouchTargets
        : defaults.largeTouchTargets,
    highContrastText:
      typeof settings.highContrastText === 'boolean'
        ? settings.highContrastText
        : defaults.highContrastText,
    increasedLetterSpacing:
      typeof settings.increasedLetterSpacing === 'boolean'
        ? settings.increasedLetterSpacing
        : defaults.increasedLetterSpacing,
    increasedWordSpacing:
      typeof settings.increasedWordSpacing === 'boolean'
        ? settings.increasedWordSpacing
        : defaults.increasedWordSpacing,
    showBooksTab:
      typeof settings.showBooksTab === 'boolean'
        ? settings.showBooksTab
        : defaults.showBooksTab,
    showWordsOfChristInRed:
      typeof settings.showWordsOfChristInRed === 'boolean'
        ? settings.showWordsOfChristInRed
        : defaults.showWordsOfChristInRed,
    useVerseRedLetterFallback:
      typeof settings.useVerseRedLetterFallback === 'boolean'
        ? settings.useVerseRedLetterFallback
        : defaults.useVerseRedLetterFallback,
    enableHolyDayAwareness:
      typeof settings.enableHolyDayAwareness === 'boolean'
        ? settings.enableHolyDayAwareness
        : defaults.enableHolyDayAwareness,
    holyDayReminderLeadDays: normalizeHolyDayReminderLeadDays(settings.holyDayReminderLeadDays),
    holyDayPreferences: normalizedHolyDayPreferences,
    showTextToSpeechTool:
      typeof settings.showTextToSpeechTool === 'boolean'
        ? settings.showTextToSpeechTool
        : defaults.showTextToSpeechTool,
    textToSpeechRate: normalizeTextToSpeechRate(settings.textToSpeechRate),
    customTheme: activeCustomTheme?.colors || normalizeCustomTheme(settings.customTheme),
    customThemes,
    wordsOfChristColor: sanitizeWordsOfChristColor(settings.wordsOfChristColor),
  };

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(storedSettings)
  );

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
    profile: getProfile(),
    holyDayReminders: getHolyDayReminderStore(),
  };
}

export function importAppStorageData(snapshot = {}) {
  saveSettings(snapshot.settings || getSettings());

  if (snapshot.lastRead) {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(snapshot.lastRead));
  } else {
    localStorage.removeItem(LAST_READ_KEY);
  }

  if (snapshot.lastBooksRead) {
    localStorage.setItem(LAST_BOOKS_READ_KEY, JSON.stringify(snapshot.lastBooksRead));
  } else {
    localStorage.removeItem(LAST_BOOKS_READ_KEY);
  }

  saveProfile(snapshot.profile || { name: '' });

  if (snapshot.holyDayReminders && typeof snapshot.holyDayReminders === 'object') {
    localStorage.setItem(HOLY_DAY_REMINDER_KEY, JSON.stringify(snapshot.holyDayReminders));
  } else {
    localStorage.removeItem(HOLY_DAY_REMINDER_KEY);
  }
}

export function clearAppStorageData() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(LAST_READ_KEY);
  localStorage.removeItem(LAST_BOOKS_READ_KEY);
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
