/**
 * Display and accessibility preference applier.
 *
 * Maps the user's display settings onto data-* attributes of the document
 * root element, which CSS uses to toggle animations and accessibility
 * affordances (focus indicators, link underlines, touch target sizing,
 * contrast, spacing, and color-vision modes).
 */

/**
 * Apply display/accessibility preferences to the document root.
 *
 * Sets data-* attributes on document.documentElement so styles can react to
 * the user's settings. Animations are forced off when the OS prefers reduced
 * motion. No-op outside a DOM environment.
 *
 * @param {Object} [settings] User display settings (e.g. enableAnimations,
 *   enhancedFocusIndicators, underlineLinks, largeTouchTargets,
 *   highContrastText, increasedLetterSpacing, increasedWordSpacing,
 *   colorVisionMode).
 * @returns {void}
 */
export function applyDisplayPreferences(settings = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.dataset.animations =
    settings.enableAnimations === false || prefersReducedMotion ? 'off' : 'on';
  root.dataset.accessibilityFocus = settings.enhancedFocusIndicators === false ? 'off' : 'on';
  root.dataset.accessibilityLinks = settings.underlineLinks === true ? 'on' : 'off';
  root.dataset.accessibilityTargets = settings.largeTouchTargets === true ? 'on' : 'off';
  root.dataset.accessibilityContrast = settings.highContrastText === true ? 'on' : 'off';
  root.dataset.accessibilityLetterSpacing =
    settings.increasedLetterSpacing === true ? 'on' : 'off';
  root.dataset.accessibilityWordSpacing = settings.increasedWordSpacing === true ? 'on' : 'off';
  root.dataset.accessibilityColorVision = settings.colorVisionMode || 'default';
}
