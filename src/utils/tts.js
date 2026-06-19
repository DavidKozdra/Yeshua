/**
 * Read-aloud (text-to-speech) engine for chapters, built on the Web Speech API.
 *
 * speakChapter queues one SpeechSynthesisUtterance per verse and chains them via
 * onend. It layers in mobile-robustness concerns the bare API lacks: a screen
 * Wake Lock so the device doesn't sleep mid-chapter, a periodic resume()
 * heartbeat (Android Chrome silently pauses speech when backgrounded), and a
 * Media Session integration so lock-screen / headphone controls can
 * play/pause/stop and skip tracks. It returns a cleanup function augmented with
 * pause/resume/setVolume controls.
 */

/** Playback-speed presets offered in the read-aloud UI. */
export const TTS_RATE_OPTIONS = [
  { value: 0.85, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Fast' },
  { value: 1.3, label: 'Faster' },
];

function getSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

// Keeps the screen awake while reading aloud so the phone doesn't dim/lock and freeze
// the speech engine. The lock is released automatically by the browser whenever the tab
// is hidden, so the caller must re-acquire it on `visibilitychange`.
function createScreenWakeLock() {
  let sentinel = null;
  let pendingRequest = null;
  let shouldHoldLock = false;
  let destroyed = false;

  async function acquire() {
    if (destroyed || !isWakeLockSupported()) return;
    shouldHoldLock = true;
    // Wake Lock can only be acquired while the document is visible.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (sentinel || pendingRequest) return;

    let request;
    try {
      request = navigator.wakeLock.request('screen');
      pendingRequest = request;
      const acquiredSentinel = await request;
      if (pendingRequest === request) {
        pendingRequest = null;
      }
      acquiredSentinel.addEventListener?.('release', () => {
        if (sentinel === acquiredSentinel) {
          sentinel = null;
        }
      });
      // A pause or teardown may happen while the permission request is in flight.
      if (
        destroyed ||
        !shouldHoldLock ||
        (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      ) {
        acquiredSentinel.release?.().catch(() => {});
        return;
      }
      sentinel = acquiredSentinel;
    } catch {
      // User/OS may reject (e.g. low battery). Best effort only.
      if (pendingRequest === request) {
        pendingRequest = null;
      }
    }
  }

  // Drop the current lock but allow re-acquiring later (used while paused).
  function release() {
    shouldHoldLock = false;
    const current = sentinel;
    sentinel = null;
    current?.release?.().catch(() => {});
  }

  // Permanently release; further acquire() calls are no-ops (used on teardown).
  function destroy() {
    destroyed = true;
    release();
  }

  return { acquire, release, destroy };
}

/**
 * Whether the browser supports speech synthesis (and the utterance constructor).
 * @returns {boolean}
 */
export function isTextToSpeechSupported() {
  return Boolean(getSpeechSynthesis() && typeof window.SpeechSynthesisUtterance !== 'undefined');
}

/**
 * Immediately cancel any in-progress speech synthesis (global stop).
 */
export function stopTextToSpeech() {
  const synth = getSpeechSynthesis();
  if (!synth) return;
  synth.cancel();
}

function getMediaSession() {
  if (typeof navigator === 'undefined') return null;
  return navigator.mediaSession || null;
}

function setMediaSessionPlaybackState(state) {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;
  try {
    mediaSession.playbackState = state;
  } catch {
    // Media Session support varies across browsers.
  }
}

function registerMediaSession({
  bookName,
  chapter,
  translationLabel,
  onPause,
  onResume,
  onStop,
  onPreviousTrack,
  onNextTrack,
}) {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;

  if (typeof window.MediaMetadata !== 'undefined') {
    try {
      mediaSession.metadata = new window.MediaMetadata({
        title: bookName && chapter ? `${bookName} ${chapter}` : 'Bible Reading',
        artist: translationLabel ? `Yeshua · ${translationLabel}` : 'Yeshua',
        album: 'Bible Read Aloud',
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch {
      // Metadata is optional; playback should still work without it.
    }
  }
  setMediaSessionPlaybackState('playing');

  for (const [action, handler] of [
    ['play', onResume],
    ['pause', onPause],
    ['stop', onStop],
    ['previoustrack', onPreviousTrack],
    ['nexttrack', onNextTrack],
  ]) {
    if (typeof handler !== 'function') continue;
    try {
      mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers expose Media Session but not every action.
    }
  }
}

function clearMediaSession() {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;
  setMediaSessionPlaybackState('none');
  try {
    mediaSession.metadata = null;
  } catch {
    // Metadata cleanup is best effort.
  }
  for (const action of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']) {
    try { mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
  }
}

/**
 * Read a chapter aloud, speaking each verse in sequence with optional spoken
 * chapter/verse-number announcements. Manages a screen wake lock, a backgrounded
 * resume heartbeat, and lock-screen Media Session controls for the duration.
 *
 * @param {object} options
 * @param {string} options.bookName
 * @param {number} options.chapter
 * @param {string} [options.translationLabel='']
 * @param {Array<{ verse: number, text: string }>} options.verses
 * @param {number} [options.rate=1] Speech rate.
 * @param {boolean} [options.announceChapterNumbers=true] Speak "Book Chapter" before verse 1.
 * @param {boolean} [options.announceVerseNumbers=true] Speak "verse N" before each verse.
 * @param {string} [options.voiceUri=''] Preferred voice URI/name; falls back to default.
 * @param {number} [options.volume=1] Initial volume (0-1).
 * @param {(verseNumber: number) => void} [options.onVerseStart]
 * @param {(state: 'playing'|'paused') => void} [options.onPlaybackStateChange]
 * @param {() => void} [options.onPreviousTrack] Media Session previous-track handler.
 * @param {() => void} [options.onNextTrack] Media Session next-track handler.
 * @param {() => void} [options.onStop] Called when stopped via Media Session.
 * @param {() => void} [options.onComplete] Called when the chapter finishes.
 * @param {(error: any) => void} [options.onError] Called on a speech error.
 * @returns {(() => void) & { setVolume: (v: number) => void, pause: () => boolean, resume: () => boolean, isPaused: () => boolean }}
 *   A cleanup/stop function with attached playback controls.
 */
export function speakChapter({
  bookName,
  chapter,
  translationLabel = '',
  verses,
  rate = 1,
  announceChapterNumbers = true,
  announceVerseNumbers = true,
  voiceUri = '',
  volume = 1,
  onVerseStart,
  onPlaybackStateChange,
  onPreviousTrack,
  onNextTrack,
  onStop,
  onComplete,
  onError,
}) {
  const synth = getSpeechSynthesis();
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') {
    throw new Error('Text-to-speech is not available in this browser.');
  }

  const queue = Array.isArray(verses)
    ? verses.filter((verse) => typeof verse?.text === 'string' && verse.text.trim())
    : [];

  if (queue.length === 0) {
    onComplete?.();
    return () => {};
  }

  synth.cancel();

  let cancelled = false;
  let activeUtterance = null;
  let requestedVolume = Math.max(0, Math.min(volume, 1));
  let isPaused = false;

  // Hold a screen wake lock so the phone doesn't sleep mid-chapter.
  const wakeLock = createScreenWakeLock();
  wakeLock.acquire();

  // Android Chrome silently stops speechSynthesis when backgrounded.
  // Calling resume() periodically keeps it alive across app switches.
  const heartbeatId = window.setInterval(() => {
    // Only nudge the engine when it self-paused while we still expect playback.
    // Calling resume() during active speech can restart/stutter the current
    // utterance on desktop browsers.
    if (!cancelled && !isPaused && synth.speaking && synth.paused) {
      synth.resume();
    }
  }, 10000);

  function handleVisibilityChange() {
    if (cancelled) return;
    if (document.visibilityState === 'visible') {
      // The browser drops the wake lock whenever the tab is hidden; take it back.
      if (!isPaused) wakeLock.acquire();
      if (!isPaused && synth.paused) {
        synth.resume();
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  function teardown() {
    window.clearInterval(heartbeatId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    wakeLock.destroy();
    clearMediaSession();
  }

  function finish() {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    teardown();
    onComplete?.();
  }

  function pausePlayback() {
    if (cancelled || isPaused) return false;
    isPaused = true;
    synth.pause();
    wakeLock.release();
    setMediaSessionPlaybackState('paused');
    onPlaybackStateChange?.('paused');
    return true;
  }

  function resumePlayback() {
    if (cancelled || !isPaused) return false;
    isPaused = false;
    synth.resume();
    wakeLock.acquire();
    setMediaSessionPlaybackState('playing');
    onPlaybackStateChange?.('playing');
    return true;
  }

  registerMediaSession({
    bookName,
    chapter,
    translationLabel,
    onPause: pausePlayback,
    onResume: resumePlayback,
    onPreviousTrack,
    onNextTrack,
    onStop: () => {
      if (!cancelled) {
        cancelled = true;
        activeUtterance = null;
        synth.cancel();
        teardown();
        onStop?.();
      }
    },
  });

  function speakAt(index) {
    if (cancelled) return;

    const verse = queue[index];
    if (!verse) {
      finish();
      return;
    }

    onVerseStart?.(verse.verse);

    const prefixParts = [];
    if (index === 0 && announceChapterNumbers && bookName) {
      prefixParts.push(`${bookName} ${chapter}`);
    }
    if (announceVerseNumbers) {
      prefixParts.push(`verse ${verse.verse}`);
    }
    const prefix = prefixParts.length ? `${prefixParts.join(', ')}. ` : '';
    const utterance = new window.SpeechSynthesisUtterance(`${prefix}${verse.text}`);
    utterance.volume = requestedVolume;
    if (voiceUri) {
      const matchedVoice = synth
        .getVoices()
        .find((voice) => voice.voiceURI === voiceUri || voice.name === voiceUri);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }
    utterance.rate = rate;
    activeUtterance = utterance;

    utterance.onend = () => {
      if (cancelled || activeUtterance !== utterance) return;
      speakAt(index + 1);
    };

    utterance.onerror = (event) => {
      if (cancelled || activeUtterance !== utterance) return;
      cancelled = true;
      activeUtterance = null;
      teardown();
      onError?.(event.error || 'Speech playback failed.');
    };

    synth.speak(utterance);
  }

  speakAt(0);

  const cleanup = () => {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    synth.cancel();
    teardown();
  };

  cleanup.setVolume = (nextVolume) => {
    requestedVolume = Math.max(0, Math.min(nextVolume, 1));
    if (activeUtterance) {
      activeUtterance.volume = requestedVolume;
    }
  };
  cleanup.pause = pausePlayback;
  cleanup.resume = resumePlayback;
  cleanup.isPaused = () => isPaused;

  return cleanup;
}
