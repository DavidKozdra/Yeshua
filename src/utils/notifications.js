/**
 * Browser notification helpers for the Yeshua app.
 *
 * Wraps the Web Notifications API to expose support detection, permission
 * querying/requesting, and a unified way to display notifications. Prefers the
 * service worker registration (for installed PWA behavior) and falls back to the
 * Notification constructor when no service worker is available.
 */

const NOTIFICATION_ICON = '/icon-192.png';
const NOTIFICATION_BADGE = '/icon-192.png';

/**
 * Detects whether the current environment supports browser notifications.
 * @returns {boolean} True when running in a browser that exposes the Notification API.
 */
export function areBrowserNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns the current notification permission state.
 * @returns {'granted'|'denied'|'default'|'unsupported'} The permission status, or
 *   'unsupported' when notifications are unavailable.
 */
export function getBrowserNotificationPermission() {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
}

/**
 * Prompts the user to grant notification permission.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>} The resulting
 *   permission state, or 'unsupported' when notifications are unavailable.
 */
export async function requestBrowserNotificationPermission() {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

/**
 * Displays a browser notification, preferring the service worker registration and
 * falling back to the Notification constructor. No-ops when notifications are
 * unsupported or permission has not been granted.
 * @param {Object} params Notification content.
 * @param {string} params.title The notification title.
 * @param {string} params.body The notification body text.
 * @param {string} params.tag A tag used to coalesce/replace notifications.
 * @returns {Promise<boolean>} True if a notification was shown, false otherwise.
 */
export async function showBrowserNotification({
  title,
  body,
  tag,
}) {
  if (!areBrowserNotificationsSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const options = {
    body,
    tag,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return true;
    } catch {
      // Fall back to the Notification constructor below.
    }
  }

  new Notification(title, options);
  return true;
}
