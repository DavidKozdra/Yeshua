/**
 * External link navigation helpers.
 *
 * Detects whether the app is running inside an embedded/iframed browser
 * context and provides the appropriate anchor props so external links open in
 * a new tab when standalone but stay in-frame when embedded.
 */

/**
 * Detect whether the app is running inside an embedded browser context.
 *
 * Treats the page as embedded when it is framed (window.self !== window.top),
 * and assumes embedded when cross-origin access throws.
 *
 * @returns {boolean} True if embedded/iframed, false otherwise.
 */
export function isEmbeddedBrowserContext() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Get anchor props for opening an external link.
 *
 * Returns empty props when embedded (so links stay in-frame), otherwise
 * returns target/rel props to open safely in a new tab.
 *
 * @returns {{target?: string, rel?: string}} Props to spread onto an anchor.
 */
export function getExternalNavigationProps() {
  if (isEmbeddedBrowserContext()) {
    return {};
  }

  return {
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}
