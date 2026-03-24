const NOTIFICATION_ICON = '/icon-192.png';
const NOTIFICATION_BADGE = '/icon-192.png';

export function areBrowserNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission() {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

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
