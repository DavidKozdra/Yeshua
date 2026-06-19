/**
 * Theming engine: applies built-in and user-defined custom themes to the
 * document, and analyzes custom palettes for accessibility.
 *
 * Built-in themes are CSS-driven via a `data-theme` attribute. Custom themes are
 * defined by a small set of seed colors (CUSTOM_THEME_DEFAULT); from those,
 * buildCustomThemeVariables derives the full set of CSS custom properties
 * (borders, hovers, muted text, etc.) by mixing/lightening/darkening. The
 * analysis helpers compute WCAG contrast ratios and simulate color-vision
 * deficiencies to warn when a palette is hard to read or relies on color alone.
 */
const FALLBACK_SHADOW = '0 2px 12px rgba(0, 0, 0, 0.3)';
const FALLBACK_SHADOW_LG = '0 8px 32px rgba(0, 0, 0, 0.4)';
import { DEFAULT_WORDS_OF_CHRIST_COLOR } from './wordsOfChrist';

/** Ids of the themes shipped with the app (CSS-driven via data-theme). */
export const BUILT_IN_THEMES = ['dark', 'light', 'sepia', 'cool', 'princess'];
/** Prefix that marks a theme id as a saved user-defined custom theme. */
export const CUSTOM_THEME_PREFIX = 'custom:';
/** Default display name for a new custom theme. */
export const DEFAULT_CUSTOM_THEME_NAME = 'Custom Theme';
/** Supported color-vision simulation modes for accessibility analysis. */
export const COLOR_VISION_MODES = ['default', 'deuteranopia', 'protanopia', 'tritanopia'];

/** Seed colors for a custom theme; all other CSS variables are derived from these. */
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

/**
 * Read the OS-level color scheme preference, defaulting to 'dark' when matchMedia
 * is unavailable (e.g. SSR).
 * @returns {'light'|'dark'}
 */
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
  return getRelativeLuminance(color);
}

function getRelativeLuminance(color) {
  const { r, g, b } = hexToRgb(color);
  const normalized = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2];
}

function getContrastRatio(colorA, colorB) {
  const lighter = Math.max(getRelativeLuminance(colorA), getRelativeLuminance(colorB));
  const darker = Math.min(getRelativeLuminance(colorA), getRelativeLuminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}

function applyColorBlindMatrix(color, matrix) {
  const { r, g, b } = hexToRgb(color);
  const [nextR, nextG, nextB] = [
    matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b,
    matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b,
    matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b,
  ];

  return {
    r: clamp(nextR),
    g: clamp(nextG),
    b: clamp(nextB),
  };
}

function getColorDistance(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const COLOR_BLIND_SIMULATION_MATRICES = {
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
};

function simulateColorVision(color, mode) {
  const matrix = COLOR_BLIND_SIMULATION_MATRICES[mode];
  if (!matrix) {
    return color;
  }

  return rgbToHex(applyColorBlindMatrix(color, matrix));
}

/**
 * Evaluate a custom palette for accessibility: computes WCAG contrast ratios for
 * key text/surface/accent pairings and checks whether semantic colors (accent /
 * success / danger) stay distinguishable under color-vision deficiencies.
 * @param {object} [customTheme] Raw seed colors (will be normalized).
 * @returns {{ normalized: object, metrics: object, issues: Array<object>, hasIssues: boolean, hasHighSeverityIssues: boolean }}
 */
export function analyzeCustomTheme(customTheme = {}) {
  const normalized = normalizeCustomTheme(customTheme);
  const issues = [];
  const metrics = {
    bodyContrast: getContrastRatio(normalized.textPrimary, normalized.bgPrimary),
    surfaceContrast: getContrastRatio(normalized.textPrimary, normalized.bgSecondary),
    secondaryContrast: getContrastRatio(normalized.textSecondary, normalized.bgSecondary),
    accentContrast: getContrastRatio(normalized.accent, normalized.bgSecondary),
    successContrast: getContrastRatio(normalized.success, normalized.bgSecondary),
    dangerContrast: getContrastRatio(normalized.danger, normalized.bgSecondary),
  };

  if (metrics.bodyContrast < 4.5) {
    issues.push({
      id: 'body-contrast',
      severity: 'high',
      title: 'Body text contrast is too low',
      detail: `Primary text only reaches ${metrics.bodyContrast.toFixed(2)}:1 against the page background.`,
    });
  }

  if (metrics.surfaceContrast < 4.5) {
    issues.push({
      id: 'surface-contrast',
      severity: 'high',
      title: 'Cards may be hard to read',
      detail: `Primary text reaches ${metrics.surfaceContrast.toFixed(2)}:1 on surfaces.`,
    });
  }

  if (metrics.secondaryContrast < 3.5) {
    issues.push({
      id: 'secondary-contrast',
      severity: 'medium',
      title: 'Secondary text may fade too much',
      detail: `Secondary copy reaches ${metrics.secondaryContrast.toFixed(2)}:1 on cards.`,
    });
  }

  if (metrics.accentContrast < 3) {
    issues.push({
      id: 'accent-contrast',
      severity: 'medium',
      title: 'Accent controls may not stand out',
      detail: `Accent color reaches ${metrics.accentContrast.toFixed(2)}:1 on surfaces.`,
    });
  }

  const semanticColors = [
    { key: 'accent', label: 'accent', color: normalized.accent },
    { key: 'success', label: 'success', color: normalized.success },
    { key: 'danger', label: 'danger', color: normalized.danger },
  ];

  for (const mode of ['deuteranopia', 'protanopia', 'tritanopia']) {
    for (let index = 0; index < semanticColors.length; index += 1) {
      for (let comparisonIndex = index + 1; comparisonIndex < semanticColors.length; comparisonIndex += 1) {
        const left = semanticColors[index];
        const right = semanticColors[comparisonIndex];
        const simulatedLeft = simulateColorVision(left.color, mode);
        const simulatedRight = simulateColorVision(right.color, mode);
        const distance = getColorDistance(simulatedLeft, simulatedRight);

        if (distance < 52) {
          issues.push({
            id: `${mode}-${left.key}-${right.key}`,
            severity: 'medium',
            title: `${left.label} and ${right.label} may blur together for ${mode}`,
            detail: 'Do not rely on color alone for status states in this palette.',
          });
        }
      }
    }
  }

  return {
    normalized,
    metrics,
    issues,
    hasIssues: issues.length > 0,
    hasHighSeverityIssues: issues.some((issue) => issue.severity === 'high'),
  };
}

/**
 * Coerce a raw custom-theme object into a complete, valid set of seed colors,
 * sanitizing each field to a #rrggbb hex and filling missing fields from defaults.
 * @param {object} [customTheme]
 * @returns {object} Normalized seed colors keyed by CUSTOM_THEME_DEFAULT fields.
 */
export function normalizeCustomTheme(customTheme = {}) {
  const normalized = {};
  for (const key of CUSTOM_THEME_FIELDS) {
    normalized[key] = sanitizeHex(customTheme[key], CUSTOM_THEME_DEFAULT[key]);
  }
  return normalized;
}

/**
 * Generate a unique custom-theme id from a name (prefixed + slugified), adding a
 * numeric suffix to avoid collisions with existing themes.
 * @param {string} name
 * @param {Array<{id?: string}>} [existingThemes]
 * @returns {string}
 */
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

/**
 * Whether a theme id refers to one of the built-in themes.
 * @param {string} themeId
 * @returns {boolean}
 */
export function isBuiltInTheme(themeId) {
  return BUILT_IN_THEMES.includes(themeId);
}

/**
 * Normalize a saved list of custom themes: sanitizes names, assigns ids where
 * missing, drops duplicates, and normalizes each theme's colors.
 * @param {Array<object>} [customThemes]
 * @returns {Array<{ id: string, name: string, colors: object }>}
 */
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

/**
 * Find a saved custom theme by id.
 * @param {Array<{id: string}>} [customThemes]
 * @param {string} themeId
 * @returns {object|null}
 */
export function getCustomThemeById(customThemes = [], themeId) {
  if (!Array.isArray(customThemes) || typeof themeId !== 'string') return null;
  return customThemes.find((theme) => theme.id === themeId) || null;
}

/**
 * Resolve the custom theme currently selected in settings, if any. Handles both
 * the legacy inline 'custom' theme and named saved themes; returns null when the
 * active theme is a built-in.
 * @param {object} settings
 * @returns {{ id: string, name: string, colors: object }|null}
 */
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

/**
 * Derive the full set of CSS custom properties for a custom theme from its seed
 * colors, computing surfaces, borders, hovers, muted text, and an accent-hover
 * that lightens or darkens depending on the accent's luminance.
 * @param {object} [customTheme] Seed colors (will be normalized).
 * @returns {Object<string, string>} CSS variable name to value map.
 */
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

/**
 * Remove all custom-theme CSS variables from an element so a built-in theme's
 * stylesheet values take over again.
 * @param {HTMLElement} [root=document.documentElement]
 */
export function clearCustomTheme(root = document.documentElement) {
  for (const variable of CUSTOM_THEME_VARIABLES) {
    root.style.removeProperty(variable);
  }
}

/**
 * Apply the theme from settings to the document root: sets data-theme and, for
 * custom themes, the derived CSS variables; also sets the words-of-Christ color.
 * Falls back to the system preference / first built-in theme when unset.
 * @param {object} settings
 */
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
