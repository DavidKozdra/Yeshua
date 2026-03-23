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
import {
  DEFAULT_TEXT_TO_SPEECH_VOICE,
  DEFAULT_TEXT_TO_SPEECH_VOLUME,
  normalizeTextToSpeechVolume,
  TTS_RATE_OPTIONS,
} from './tts';

const SETTINGS_KEY = 'yeshua-settings';
const LAST_READ_KEY = 'yeshua-last-read';
const PROFILE_KEY = 'yeshua-profile';
const SETTINGS_EVENT = 'yeshua-settings-changed';
const VALID_TTS_RATES = new Set(TTS_RATE_OPTIONS.map((option) => option.value));

const defaults = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'dark',
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  showVerseNumbers: true,
  oneVersePerLine: false,
  showGlobalSearchBar: true,
  showTextToSpeechTool: true,
  textToSpeechRate: 1,
  textToSpeechVoice: DEFAULT_TEXT_TO_SPEECH_VOICE,
  textToSpeechVolume: DEFAULT_TEXT_TO_SPEECH_VOLUME,
  customTheme: CUSTOM_THEME_DEFAULT,
  customThemes: [],
};

function normalizeTextToSpeechVoice(value) {
  return typeof value === 'string' ? value : DEFAULT_TEXT_TO_SPEECH_VOICE;
}

function normalizeTextToSpeechRate(value) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  return VALID_TTS_RATES.has(parsedValue) ? parsedValue : defaults.textToSpeechRate;
}

function normalizeSettings(parsedSettings = {}) {
  const defaultTranslation = getTranslationById(parsedSettings.defaultTranslation)
    ? parsedSettings.defaultTranslation
    : DEFAULT_TRANSLATION_ID;
  const normalizedCustomTheme = normalizeCustomTheme(parsedSettings.customTheme);
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
    showTextToSpeechTool:
      typeof parsedSettings.showTextToSpeechTool === 'boolean'
        ? parsedSettings.showTextToSpeechTool
        : defaults.showTextToSpeechTool,
    textToSpeechRate: normalizeTextToSpeechRate(parsedSettings.textToSpeechRate),
    textToSpeechVoice: normalizeTextToSpeechVoice(parsedSettings.textToSpeechVoice),
    textToSpeechVolume: normalizeTextToSpeechVolume(parsedSettings.textToSpeechVolume),
    customTheme: normalizedCustomTheme,
    customThemes,
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
    theme:
      typeof settings.theme === 'string' &&
      (isBuiltInTheme(settings.theme) || activeCustomTheme)
        ? settings.theme
        : defaults.theme,
    showTextToSpeechTool:
      typeof settings.showTextToSpeechTool === 'boolean'
        ? settings.showTextToSpeechTool
        : defaults.showTextToSpeechTool,
    textToSpeechRate: normalizeTextToSpeechRate(settings.textToSpeechRate),
    textToSpeechVoice: normalizeTextToSpeechVoice(settings.textToSpeechVoice),
    textToSpeechVolume: normalizeTextToSpeechVolume(settings.textToSpeechVolume),
    customTheme: activeCustomTheme?.colors || normalizeCustomTheme(settings.customTheme),
    customThemes,
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
