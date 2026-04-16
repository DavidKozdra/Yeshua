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

export function getExternalNavigationProps() {
  if (isEmbeddedBrowserContext()) {
    return {};
  }

  return {
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}
