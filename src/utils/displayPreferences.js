export function applyDisplayPreferences(settings = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.animations = settings.enableAnimations === false ? 'off' : 'on';
  root.dataset.accessibilityFocus = settings.enhancedFocusIndicators === false ? 'off' : 'on';
  root.dataset.accessibilityLinks = settings.underlineLinks === true ? 'on' : 'off';
  root.dataset.accessibilityTargets = settings.largeTouchTargets === true ? 'on' : 'off';
}
