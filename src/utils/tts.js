export const TTS_RATE_OPTIONS = [
  { value: 0.85, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Fast' },
  { value: 1.3, label: 'Faster' },
];

const TTS_AUTOPLAY_UNLOCK_KEY = 'yeshua-tts-autoplay-unlocked';
let speechAutoplayUnlocked = false;
let unlockAudioContext = null;

function readAutoplayUnlockFlag() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return false;
  }

  try {
    return window.sessionStorage.getItem(TTS_AUTOPLAY_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function persistAutoplayUnlockFlag() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(TTS_AUTOPLAY_UNLOCK_KEY, '1');
  } catch {
    // best effort only
  }
}

function tryUnlockAudioContext() {
  if (unlockAudioContext) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    const context = new AudioContextClass();
    unlockAudioContext = context;
    context.resume().catch(() => {});
    const zeroGain = context.createGain();
    zeroGain.gain.value = 0;
    zeroGain.connect(context.destination);
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 0;
    oscillator.connect(zeroGain);
    oscillator.start();
    oscillator.stop(context.currentTime);
    oscillator.onended = () => {
      oscillator.disconnect();
      zeroGain.disconnect();
    };
  } catch {
    // ignore errors; unlocking is best effort
    unlockAudioContext = null;
  }
}

export function isSpeechAutoplayUnlocked() {
  if (speechAutoplayUnlocked) {
    return true;
  }

  if (readAutoplayUnlockFlag()) {
    speechAutoplayUnlocked = true;
    return true;
  }

  return false;
}

export function unlockSpeechAutoplay() {
  if (isSpeechAutoplayUnlocked()) {
    return true;
  }

  speechAutoplayUnlocked = true;
  persistAutoplayUnlockFlag();
  tryUnlockAudioContext();
  return true;
}

export function pauseSpeechSynthesis() {
  const synth = getSpeechSynthesis();
  if (synth && synth.speaking && !synth.paused) {
    synth.pause();
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }
}

export function resumeSpeechSynthesis() {
  const synth = getSpeechSynthesis();
  if (synth && synth.paused) {
    synth.resume();
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }
}

function getSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

export function isTextToSpeechSupported() {
  return Boolean(getSpeechSynthesis() && typeof window.SpeechSynthesisUtterance !== 'undefined');
}

export function stopTextToSpeech() {
  const synth = getSpeechSynthesis();
  if (!synth) return;
  synth.cancel();
}

function registerMediaSession({ bookName, chapter, onPause, onResume, onStop }) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new window.MediaMetadata({
    title: bookName && chapter ? `${bookName} ${chapter}` : 'Bible Reading',
    artist: 'Yeshua',
    artwork: [
      { src: '/icon-192.png',          sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png',          sizes: '512x512', type: 'image/png' },
      { src: '/maskable-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
  navigator.mediaSession.playbackState = 'playing';

  navigator.mediaSession.setActionHandler('play', onResume);
  navigator.mediaSession.setActionHandler('pause', onPause);
  navigator.mediaSession.setActionHandler('stop', onStop);
}

function clearMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = 'none';
  for (const action of ['play', 'pause', 'stop']) {
    try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
  }
}

export function speakChapter({
  bookName,
  chapter,
  verses,
  rate = 1,
  announceChapterNumbers = true,
  announceVerseNumbers = true,
  voiceUri = '',
  volume = 1,
  onVerseStart,
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

  // Android Chrome silently stops speechSynthesis when backgrounded.
  // Calling resume() periodically keeps it alive across app switches.
  const heartbeatId = window.setInterval(() => {
    if (!cancelled && !isPaused && synth.speaking) {
      synth.resume();
    }
  }, 10000);

  function handleVisibilityChange() {
    if (cancelled) return;
    if (document.visibilityState === 'visible' && !isPaused && synth.paused) {
      synth.resume();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  function teardown() {
    window.clearInterval(heartbeatId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearMediaSession();
  }

  function finish() {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    teardown();
    onComplete?.();
  }

  registerMediaSession({
    bookName,
    chapter,
    onPause: () => {
      if (!cancelled && !isPaused) {
        isPaused = true;
        synth.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
    },
    onResume: () => {
      if (!cancelled && isPaused) {
        isPaused = false;
        synth.resume();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    },
    onStop: () => {
      if (!cancelled) {
        cancelled = true;
        activeUtterance = null;
        synth.cancel();
        teardown();
        // Treat MediaSession stop as a normal completion, not an error
        onComplete?.();
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
    if (announceChapterNumbers && bookName) {
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
      // 'interrupted' fires when synth.cancel() is called — treat as normal stop, not error
      if (event.error === 'interrupted') return;
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

  return cleanup;
}
