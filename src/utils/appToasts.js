/**
 * appToasts
 *
 * Lightweight global toast bus built on a window CustomEvent. Provides a
 * publish/subscribe pair so any module can surface a transient toast
 * notification without a direct reference to the toast UI component. SSR-safe:
 * all operations no-op when `window` is unavailable.
 */

const APP_TOAST_EVENT = 'yeshua-app-toast';

/**
 * Broadcast a toast to any subscribed listeners via a window CustomEvent.
 * @param {*} toast Arbitrary toast payload delivered to listeners as event detail.
 * @returns {void}
 */
export function dispatchAppToast(toast) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: toast,
    })
  );
}

/**
 * Subscribe to app toast events.
 * @param {(toast: *) => void} listener Invoked with the toast detail for each dispatched toast.
 * @returns {() => void} Unsubscribe function that removes the listener.
 */
export function subscribeToAppToasts(listener) {
  if (typeof window === 'undefined') return () => {};

  function handleToast(event) {
    listener(event.detail);
  }

  window.addEventListener(APP_TOAST_EVENT, handleToast);
  return () => {
    window.removeEventListener(APP_TOAST_EVENT, handleToast);
  };
}
