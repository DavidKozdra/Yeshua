const FALLBACK_SHADOW = '0 2px 12px rgba(0, 0, 0, 0.3)';
const FALLBACK_SHADOW_LG = '0 8px 32px rgba(0, 0, 0, 0.4)';
import { DEFAULT_WORDS_OF_CHRIST_COLOR } from './wordsOfChrist';

export const BUILT_IN_THEMES = ['dark', 'light', 'sepia'];
export const CUSTOM_THEME_PREFIX = 'custom:';
export const DEFAULT_CUSTOM_THEME_NAME = 'Custom Theme';

export const CUSTOM_THEME_DEFAULT = {
  bgPrimary: '#101722',
  bgSecondary: '#172232',
  bgInput: '#223247',
  textPrimary: '#f3efe6',
  textSecondary: '#b6c1cd',
  accent: '#d49c3d',
  success: '#2ecc71',
  danger: '#e74c3c',
};

const CUSTOM_THEME_FIELDS = Object.keys(CUSTOM_THEME_DEFAULT);
const CUSTOM_THEME_VARIABLES = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-card',
  '--bg-hover',
  '--bg-input',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-hover',
  '--accent-subtle',
  '--border',
  '--border-light',
  '--danger',
  '--danger-hover',
  '--success',
  '--note-indicator',
  '--shadow',
  '--shadow-lg',
];

export function getSystemThemePreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeCustomThemeName(name) {
  if (typeof name !== 'string') return DEFAULT_CUSTOM_THEME_NAME;

  const normalized = name.trim().replace(/\s+/g, ' ');
  return normalized || DEFAULT_CUSTOM_THEME_NAME;
}

function slugifyThemeName(name) {
  const baseSlug = sanitizeCustomThemeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return baseSlug || 'theme';
}

function sanitizeHex(value, fallback) {
  if (typeof value !== 'string') return fallback;
  let hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex) {
  const normalized = sanitizeHex(hex, '#000000').slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColors(colorA, colorB, ratio = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

function lighten(color, amount = 0.1) {
  return mixColors(color, '#ffffff', amount);
}

function darken(color, amount = 0.1) {
  return mixColors(color, '#000000', amount);
}

function rgba(color, alpha) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getLuminance(color) {
  const { r, g, b } = hexToRgb(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function normalizeCustomTheme(customTheme = {}) {
  const normalized = {};
  for (const key of CUSTOM_THEME_FIELDS) {
    normalized[key] = sanitizeHex(customTheme[key], CUSTOM_THEME_DEFAULT[key]);
  }
  return normalized;
}

export function createCustomThemeId(name, existingThemes = []) {
  const existingIds = new Set(
    Array.isArray(existingThemes)
      ? existingThemes.map((theme) => theme?.id).filter(Boolean)
      : []
  );
  const baseSlug = slugifyThemeName(name);
  let suffix = 0;
  let nextId = `${CUSTOM_THEME_PREFIX}${baseSlug}`;

  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${CUSTOM_THEME_PREFIX}${baseSlug}-${suffix}`;
  }

  return nextId;
}

export function isBuiltInTheme(themeId) {
  return BUILT_IN_THEMES.includes(themeId);
}

export function normalizeCustomThemes(customThemes = []) {
  if (!Array.isArray(customThemes)) return [];

  const normalizedThemes = [];
  const seenIds = new Set();

  for (const theme of customThemes) {
    const name = sanitizeCustomThemeName(theme?.name);
    const id =
      typeof theme?.id === 'string' && theme.id.trim()
        ? theme.id.trim()
        : createCustomThemeId(name, normalizedThemes);

    if (seenIds.has(id)) continue;
    seenIds.add(id);

    normalizedThemes.push({
      id,
      name,
      colors: normalizeCustomTheme(theme?.colors || theme),
    });
  }

  return normalizedThemes;
}

export function getCustomThemeById(customThemes = [], themeId) {
  if (!Array.isArray(customThemes) || typeof themeId !== 'string') return null;
  return customThemes.find((theme) => theme.id === themeId) || null;
}

export function getActiveCustomTheme(settings) {
  if (!settings) return null;
  if (settings.theme === 'custom') {
    return {
      id: createCustomThemeId(DEFAULT_CUSTOM_THEME_NAME),
      name: DEFAULT_CUSTOM_THEME_NAME,
      colors: normalizeCustomTheme(settings.customTheme),
    };
  }

  return getCustomThemeById(settings.customThemes, settings.theme);
}

export function buildCustomThemeVariables(customTheme = {}) {
  const normalized = normalizeCustomTheme(customTheme);
  const accentHover =
    getLuminance(normalized.accent) > 0.6
      ? darken(normalized.accent, 0.14)
      : lighten(normalized.accent, 0.12);

  return {
    '--bg-primary': normalized.bgPrimary,
    '--bg-secondary': normalized.bgSecondary,
    '--bg-tertiary': mixColors(normalized.bgSecondary, normalized.bgInput, 0.55),
    '--bg-card': normalized.bgSecondary,
    '--bg-hover': mixColors(normalized.bgInput, normalized.accent, 0.08),
    '--bg-input': normalized.bgInput,
    '--text-primary': normalized.textPrimary,
    '--text-secondary': normalized.textSecondary,
    '--text-muted': mixColors(normalized.textSecondary, normalized.bgSecondary, 0.4),
    '--accent': normalized.accent,
    '--accent-hover': accentHover,
    '--accent-subtle': rgba(normalized.accent, 0.16),
    '--border': mixColors(normalized.bgSecondary, normalized.textPrimary, 0.14),
    '--border-light': mixColors(normalized.bgSecondary, normalized.textPrimary, 0.22),
    '--danger': normalized.danger,
    '--danger-hover': darken(normalized.danger, 0.14),
    '--success': normalized.success,
    '--note-indicator': normalized.accent,
    '--shadow': FALLBACK_SHADOW,
    '--shadow-lg': FALLBACK_SHADOW_LG,
  };
}

export function clearCustomTheme(root = document.documentElement) {
  for (const variable of CUSTOM_THEME_VARIABLES) {
    root.style.removeProperty(variable);
  }
}

export function applyTheme(settings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const theme = settings?.theme || getSystemThemePreference();
  const activeCustomTheme = getActiveCustomTheme(settings);
  const wordsOfChristColor =
    settings?.wordsOfChristColor || DEFAULT_WORDS_OF_CHRIST_COLOR;

  if (activeCustomTheme) {
    root.setAttribute('data-theme', 'custom');
    const variables = buildCustomThemeVariables(activeCustomTheme.colors);
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
    root.style.setProperty('--words-of-christ-color', wordsOfChristColor);
    return;
  }

  clearCustomTheme(root);
  root.setAttribute('data-theme', isBuiltInTheme(theme) ? theme : BUILT_IN_THEMES[0]);
  root.style.setProperty('--words-of-christ-color', wordsOfChristColor);
}
