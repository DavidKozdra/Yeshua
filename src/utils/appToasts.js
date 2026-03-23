const APP_TOAST_EVENT = 'yeshua-app-toast';

export function dispatchAppToast(toast) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: toast,
    })
  );
}

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
