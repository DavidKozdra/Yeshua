import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchChapter } from '../utils/api';
import { getBookById, getTranslationById } from '../utils/bibleData';
import {
  getNextBibleChapter,
  getPreviousBibleChapter,
} from '../utils/bibleNavigation';
import { isTextToSpeechSupported, speakChapter } from '../utils/tts';
import { useAppSettings } from '../hooks/useAppSettings';

const ReadAloudContext = createContext(null);
const SESSION_STORAGE_KEY = 'yeshua-read-aloud-session';
const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const IDLE_STATE = {
  status: 'idle',
  translationId: null,
  bookId: null,
  chapter: null,
  verse: null,
  continuous: true,
  error: '',
};

function readStoredSession() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
    if (
      !stored ||
      typeof stored.translationId !== 'string' ||
      typeof stored.bookId !== 'string' ||
      !Number.isInteger(stored.chapter) ||
      Date.now() - stored.updatedAt > SESSION_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      ...IDLE_STATE,
      status: 'paused',
      translationId: stored.translationId,
      bookId: stored.bookId,
      chapter: stored.chapter,
      verse: Number.isInteger(stored.verse) ? stored.verse : 1,
      continuous: stored.continuous !== false,
    };
  } catch {
    return null;
  }
}

function persistSession(state) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  if (!['loading', 'playing', 'paused'].includes(state.status)) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      translationId: state.translationId,
      bookId: state.bookId,
      chapter: state.chapter,
      verse: state.verse,
      continuous: state.continuous,
      updatedAt: Date.now(),
    })
  );
}

function targetKey(target) {
  return target ? `${target.translationId}:${target.bookId}:${target.chapter}` : '';
}

export function ReadAloudProvider({ children }) {
  const settings = useAppSettings();
  const [state, setState] = useState(() => readStoredSession() || IDLE_STATE);
  const [volume, setVolumeState] = useState(1);
  const controllerRef = useRef(null);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const requestIdRef = useRef(0);
  const playTargetRef = useRef(null);
  const prefetchedChapterRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
    persistSession(state);
  }, [state]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.();
    prefetchedChapterRef.current = null;
    setState(IDLE_STATE);
  }, []);

  const playTarget = useCallback(async function playTarget(target, options = {}) {
    if (!isTextToSpeechSupported()) {
      setState({
        ...IDLE_STATE,
        status: 'error',
        error: 'Text to speech is not available in this browser.',
      });
      return false;
    }

    const book = getBookById(target.bookId);
    const translation = getTranslationById(target.translationId);
    if (!book || !translation) {
      setState({
        ...IDLE_STATE,
        status: 'error',
        error: 'The requested Bible chapter is not available.',
      });
      return false;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const previousController = controllerRef.current;
    controllerRef.current = null;
    previousController?.();

    const continuous = options.continuous !== false;
    const startVerse = Number.isInteger(options.startVerse) ? options.startVerse : 1;
    const nextState = {
      status: 'loading',
      translationId: target.translationId,
      bookId: target.bookId,
      chapter: target.chapter,
      verse: startVerse,
      continuous,
      error: '',
    };
    setState(nextState);

    try {
      const key = targetKey(target);
      const prefetched = prefetchedChapterRef.current;
      const verses =
        options.verses ||
        (prefetched?.key === key
          ? await prefetched.promise
          : await fetchChapter(target.translationId, target.bookId, target.chapter, {
              offlineOnly: true,
            }));

      if (requestId !== requestIdRef.current) return false;

      const remainingVerses = verses.filter((verse) => verse.verse >= startVerse);
      if (!remainingVerses.length) {
        throw new Error('This chapter does not contain readable verses.');
      }

      const nextTarget = getNextBibleChapter(target.bookId, target.chapter);
      if (continuous && nextTarget) {
        const prefetchedTarget = {
          translationId: target.translationId,
          ...nextTarget,
        };
        prefetchedChapterRef.current = {
          key: targetKey(prefetchedTarget),
          promise: fetchChapter(
            prefetchedTarget.translationId,
            prefetchedTarget.bookId,
            prefetchedTarget.chapter,
            { offlineOnly: true }
          ),
        };
        prefetchedChapterRef.current.promise.catch(() => {});
      } else {
        prefetchedChapterRef.current = null;
      }

      const activeSettings = settingsRef.current;
      const controller = speakChapter({
        bookName: book.name,
        chapter: target.chapter,
        translationLabel: translation.abbreviation,
        verses: remainingVerses,
        rate: activeSettings.textToSpeechRate,
        announceChapterNumbers: activeSettings.announceChapterNumbers,
        announceVerseNumbers: activeSettings.announceVerseNumbers,
        voiceUri: activeSettings.textToSpeechVoice,
        volume,
        onVerseStart: (verse) => {
          setState((current) => (
            requestId === requestIdRef.current
              ? { ...current, status: 'playing', verse, error: '' }
              : current
          ));
        },
        onPlaybackStateChange: (playbackState) => {
          setState((current) => (
            requestId === requestIdRef.current
              ? {
                  ...current,
                  status: playbackState === 'paused' ? 'paused' : 'playing',
                }
              : current
          ));
        },
        onPreviousTrack: () => {
          const previousTarget = getPreviousBibleChapter(target.bookId, target.chapter);
          if (previousTarget) {
            playTargetRef.current?.({
              translationId: target.translationId,
              ...previousTarget,
            }, { continuous });
          }
        },
        onNextTrack: () => {
          if (nextTarget) {
            playTargetRef.current?.({
              translationId: target.translationId,
              ...nextTarget,
            }, { continuous });
          }
        },
        onStop: stop,
        onComplete: () => {
          if (requestId !== requestIdRef.current) return;
          controllerRef.current = null;

          if (continuous && nextTarget) {
            playTargetRef.current?.({
              translationId: target.translationId,
              ...nextTarget,
            }, { continuous: true });
            return;
          }

          prefetchedChapterRef.current = null;
          setState(IDLE_STATE);
        },
        onError: (message) => {
          if (requestId !== requestIdRef.current) return;
          controllerRef.current = null;
          setState((current) => ({
            ...current,
            status: 'error',
            error:
              typeof message === 'string' && message.trim()
                ? message
                : 'Speech playback failed.',
          }));
        },
      });

      if (requestId !== requestIdRef.current) {
        controller();
        return false;
      }

      controllerRef.current = controller;
      setState((current) => ({ ...current, status: 'playing', error: '' }));
      return true;
    } catch (error) {
      if (requestId !== requestIdRef.current) return false;
      controllerRef.current = null;
      setState((current) => ({
        ...current,
        status: 'error',
        error: error.message || 'Speech playback could not start.',
      }));
      return false;
    }
  }, [stop, volume]);

  useEffect(() => {
    playTargetRef.current = playTarget;
  }, [playTarget]);

  useEffect(() => stop, [stop]);

  const pause = useCallback(() => {
    controllerRef.current?.pause?.();
  }, []);

  const resume = useCallback(() => {
    const controller = controllerRef.current;
    if (controller) {
      controller.resume?.();
      return;
    }

    const current = stateRef.current;
    if (current.status === 'paused' && current.translationId && current.bookId) {
      playTargetRef.current?.(
        {
          translationId: current.translationId,
          bookId: current.bookId,
          chapter: current.chapter,
        },
        {
          continuous: current.continuous,
          startVerse: current.verse || 1,
        }
      );
    }
  }, []);

  const togglePause = useCallback(() => {
    if (stateRef.current.status === 'paused') {
      resume();
    } else {
      pause();
    }
  }, [pause, resume]);

  const skipNext = useCallback(() => {
    const current = stateRef.current;
    const nextTarget = getNextBibleChapter(current.bookId, current.chapter);
    if (!nextTarget || !current.translationId) return;
    playTargetRef.current?.({
      translationId: current.translationId,
      ...nextTarget,
    }, { continuous: current.continuous });
  }, []);

  const skipPrevious = useCallback(() => {
    const current = stateRef.current;
    const previousTarget = getPreviousBibleChapter(current.bookId, current.chapter);
    if (!previousTarget || !current.translationId) return;
    playTargetRef.current?.({
      translationId: current.translationId,
      ...previousTarget,
    }, { continuous: current.continuous });
  }, []);

  const setVolume = useCallback((nextVolume) => {
    const normalized = Math.max(0, Math.min(Number(nextVolume), 1));
    setVolumeState(normalized);
    controllerRef.current?.setVolume?.(normalized);
  }, []);

  const value = useMemo(() => {
    const book = state.bookId ? getBookById(state.bookId) : null;
    const translation = state.translationId
      ? getTranslationById(state.translationId)
      : null;
    const isActive = ['loading', 'playing', 'paused'].includes(state.status);

    return {
      ...state,
      bookName: book?.name || '',
      translationLabel: translation?.abbreviation || '',
      isActive,
      isPlaying: state.status === 'playing',
      isPaused: state.status === 'paused',
      isLoading: state.status === 'loading',
      supported: isTextToSpeechSupported(),
      volume,
      start: playTarget,
      pause,
      resume,
      togglePause,
      stop,
      skipNext,
      skipPrevious,
      setVolume,
      hasNext: Boolean(getNextBibleChapter(state.bookId, state.chapter)),
      hasPrevious: Boolean(getPreviousBibleChapter(state.bookId, state.chapter)),
    };
  }, [
    state,
    volume,
    playTarget,
    pause,
    resume,
    togglePause,
    stop,
    skipNext,
    skipPrevious,
    setVolume,
  ]);

  return (
    <ReadAloudContext.Provider value={value}>
      {children}
    </ReadAloudContext.Provider>
  );
}

export function useReadAloud() {
  const context = useContext(ReadAloudContext);
  if (!context) {
    throw new Error('useReadAloud must be used within ReadAloudProvider.');
  }
  return context;
}
