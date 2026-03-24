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
