import { CUSTOM_THEME_DEFAULT, normalizeCustomTheme } from './theme';
import { DEFAULT_TRANSLATION_ID } from './translationConfig';

const SETTINGS_KEY = 'yeshua-settings';
const LAST_READ_KEY = 'yeshua-last-read';
const PROFILE_KEY = 'yeshua-profile';

const defaults = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'dark',
  defaultTranslation: DEFAULT_TRANSLATION_ID,
  showVerseNumbers: true,
  customTheme: CUSTOM_THEME_DEFAULT,
};

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { ...defaults, customTheme: { ...CUSTOM_THEME_DEFAULT } };
    }

    const parsed = JSON.parse(stored);
    return {
      ...defaults,
      ...parsed,
      customTheme: normalizeCustomTheme(parsed.customTheme),
    };
  } catch {
    return { ...defaults, customTheme: { ...CUSTOM_THEME_DEFAULT } };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      customTheme: normalizeCustomTheme(settings.customTheme),
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
