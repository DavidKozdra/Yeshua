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

const SETTINGS_KEY = 'yeshua-settings';
const LAST_READ_KEY = 'yeshua-last-read';
const PROFILE_KEY = 'yeshua-profile';

const defaults = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'dark',
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  showVerseNumbers: true,
  oneVersePerLine: false,
  customTheme: CUSTOM_THEME_DEFAULT,
  customThemes: [],
};

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

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      theme:
        typeof settings.theme === 'string' &&
        (isBuiltInTheme(settings.theme) || activeCustomTheme)
          ? settings.theme
          : defaults.theme,
      customTheme: activeCustomTheme?.colors || normalizeCustomTheme(settings.customTheme),
      customThemes,
    })
  );
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
