import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, X, XCircle } from 'lucide-react';
import { getTranslationById } from '../utils/bibleData';
import { subscribeToTranslationInstallEvents } from '../utils/api';
import { subscribeToBooksInstallEvents } from '../utils/booksApi';
import { getBooksCollectionById } from '../utils/booksData';
import { subscribeToAppToasts } from '../utils/appToasts';
import { formatInstallIssue } from '../utils/installErrors';

const TOAST_DURATION_MS = 4200;

function getTranslationLabel(translationId) {
  return getTranslationById(translationId)?.abbreviation || translationId?.toUpperCase() || 'Translation';
}

function buildToast(event) {
  const label = getTranslationLabel(event.translationId);

  if (event.type === 'queued') {
    const queuedJob = event.snapshot.jobs[event.translationId];
    const hasInstallAhead =
      Boolean(event.snapshot.activeTranslationId && event.snapshot.activeTranslationId !== event.translationId) ||
      (queuedJob?.queuePosition ?? 0) > 1;

    if (!hasInstallAhead || event.reason === 'startup') {
      return null;
    }

    return {
      tone: 'info',
      title: `${label} queued`,
      message:
        queuedJob?.queuePosition > 1
          ? `${queuedJob.queuePosition - 1} translations are ahead in the queue.`
          : 'This install will start when the current translation finishes.',
    };
  }

  if (event.type === 'completed') {
    if (event.result?.isComplete) {
      return {
        tone: 'success',
        title: `${label} ready offline`,
        message: `All ${event.result.totalChapters} chapters are saved on this device.`,
      };
    }

    return {
      tone: 'warning',
      title: `${label} partially saved`,
      message:
        formatInstallIssue(event.result?.sampleError) ||
        `${event.result?.completedChapters ?? 0} of ${event.result?.totalChapters ?? 0} chapters were saved.`,
    };
  }

  if (event.type === 'failed') {
    return {
      tone: 'danger',
      title: `${label} install failed`,
      message: event.error || 'The translation could not be saved on this device.',
    };
  }

  if (event.type === 'cancelled' && event.reason !== 'startup') {
    return {
      tone: 'info',
      title: `${label} install cancelled`,
      message:
        event.phase === 'queued'
          ? 'The translation was removed from the install queue.'
          : 'The active install was stopped before it finished.',
    };
  }

  return null;
}

function getBooksCollectionLabel(collectionId) {
  return getBooksCollectionById(collectionId)?.name || 'Collection';
}

function buildBooksToast(event) {
  const label = getBooksCollectionLabel(event.collectionId);

  if (event.type === 'queued') {
    const queuedJob = event.snapshot.jobs[event.collectionId];
    const hasInstallAhead =
      Boolean(event.snapshot.activeCollectionId && event.snapshot.activeCollectionId !== event.collectionId) ||
      (queuedJob?.queuePosition ?? 0) > 1;

    if (!hasInstallAhead) {
      return null;
    }

    return {
      tone: 'info',
      title: `${label} queued`,
      message:
        queuedJob?.queuePosition > 1
          ? `${queuedJob.queuePosition - 1} collections are ahead in the queue.`
          : 'This collection will start saving when the current install finishes.',
    };
  }

  if (event.type === 'completed') {
    if (event.result?.isComplete) {
      return {
        tone: 'success',
        title: `${label} ready offline`,
        message: `All ${event.result.totalChapters} chapters are saved on this device.`,
      };
    }

    return {
      tone: 'warning',
      title: `${label} partially saved`,
      message:
        formatInstallIssue(event.result?.sampleError) ||
        `${event.result?.completedChapters ?? 0} of ${event.result?.totalChapters ?? 0} chapters were saved.`,
    };
  }

  if (event.type === 'failed') {
    return {
      tone: 'danger',
      title: `${label} install failed`,
      message: event.error || 'The collection could not be saved on this device.',
    };
  }

  if (event.type === 'cancelled') {
    return {
      tone: 'info',
      title: `${label} install cancelled`,
      message:
        event.phase === 'queued'
          ? 'The collection was removed from the install queue.'
          : 'The active install was stopped before it finished.',
    };
  }

  return null;
}

function getToastIcon(tone) {
  if (tone === 'success') return CheckCircle2;
  if (tone === 'warning') return AlertTriangle;
  if (tone === 'danger') return XCircle;
  return Clock3;
}

function normalizeAppToast(toast) {
  if (!toast?.title || !toast?.message) return null;

  return {
    tone: ['success', 'warning', 'danger', 'info'].includes(toast.tone) ? toast.tone : 'info',
    title: toast.title,
    message: toast.message,
  };
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);
  const timeoutMapRef = useRef(new Map());
  const toastIdRef = useRef(0);

  useEffect(() => {
    function dismissToast(toastId) {
      const timeoutId = timeoutMapRef.current.get(toastId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutMapRef.current.delete(toastId);
      }

      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    }

    function queueToast(toast) {
      if (!toast) return;

      toastIdRef.current += 1;
      const toastId = toastIdRef.current;
      setToasts((current) => [...current, { ...toast, id: toastId }].slice(-4));

      const timeoutId = window.setTimeout(() => {
        dismissToast(toastId);
      }, TOAST_DURATION_MS);

      timeoutMapRef.current.set(toastId, timeoutId);
    }

    const unsubscribe = subscribeToTranslationInstallEvents((event) => {
      queueToast(buildToast(event));
    });
    const unsubscribeBooks = subscribeToBooksInstallEvents((event) => {
      queueToast(buildBooksToast(event));
    });
    const unsubscribeAppToasts = subscribeToAppToasts((toast) => {
      queueToast(normalizeAppToast(toast));
    });

    return () => {
      unsubscribe();
      unsubscribeBooks();
      unsubscribeAppToasts();
      for (const timeoutId of timeoutMapRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutMapRef.current.clear();
    };
  }, []);

  function handleDismiss(toastId) {
    const timeoutId = timeoutMapRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const Icon = getToastIcon(toast.tone);

        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <div className={`toast-icon toast-icon-${toast.tone}`}>
              <Icon size={18} />
            </div>
            <div className="toast-body">
              <p className="toast-title">{toast.title}</p>
              <p className="toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => handleDismiss(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
