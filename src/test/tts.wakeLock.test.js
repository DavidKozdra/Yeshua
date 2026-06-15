import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { speakChapter } from '../utils/tts';

// A fake screen wake-lock sentinel that records request/release calls.
function installFakeWakeLock() {
  const state = { requests: 0, releases: 0, active: 0 };
  navigator.wakeLock = {
    request: vi.fn(async (type) => {
      expect(type).toBe('screen');
      state.requests += 1;
      state.active += 1;
      const listeners = [];
      const sentinel = {
        release: vi.fn(async () => {
          state.releases += 1;
          state.active -= 1;
          listeners.forEach((fn) => fn());
        }),
        addEventListener: (event, fn) => {
          if (event === 'release') listeners.push(fn);
        },
        // Simulates the browser auto-releasing the lock when the tab is hidden.
        _platformRelease: () => {
          state.active -= 1;
          listeners.forEach((fn) => fn());
        },
      };
      state.last = sentinel;
      return sentinel;
    }),
  };
  return state;
}

// Minimal SpeechSynthesis fake. Utterances do not auto-finish; tests advance them
// explicitly via finishCurrent() so the wake-lock lifecycle can be observed mid-playback.
function installFakeSpeech() {
  const synth = {
    speaking: false,
    paused: false,
    _utterances: [],
    speak(u) {
      this.speaking = true;
      this.paused = false;
      this._utterances.push(u);
    },
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
    cancel() {
      this.speaking = false;
      this.paused = false;
    },
    getVoices: () => [],
  };
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.onend = null;
      this.onerror = null;
    }
  };
  synth.finishCurrent = () => {
    const u = synth._utterances[synth._utterances.length - 1];
    u?.onend?.();
  };
  synth.errorCurrent = (error) => {
    const u = synth._utterances[synth._utterances.length - 1];
    u?.onerror?.({ error });
  };
  return synth;
}

function setVisibility(value) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('speakChapter screen wake lock', () => {
  let wake;
  let synth;
  let mediaSessionHandlers;

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    wake = installFakeWakeLock();
    synth = installFakeSpeech();

    // Capture MediaSession action handlers so we can drive pause/resume from the lock screen.
    mediaSessionHandlers = {};
    navigator.mediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: (action, handler) => {
        mediaSessionHandlers[action] = handler;
      },
    };
    window.MediaMetadata = class {};
  });

  afterEach(() => {
    vi.useRealTimers();
    delete navigator.wakeLock;
    delete navigator.mediaSession;
  });

  const verses = [
    { verse: 1, text: 'In the beginning' },
    { verse: 2, text: 'And the earth was without form' },
  ];

  it('acquires a screen wake lock when playback starts', async () => {
    speakChapter({ bookName: 'Genesis', chapter: 1, verses });
    await vi.runAllTicks();
    expect(wake.requests).toBe(1);
    expect(wake.active).toBe(1);
  });

  it('releases the wake lock when playback completes', async () => {
    speakChapter({ bookName: 'Genesis', chapter: 1, verses });
    await vi.runAllTicks();
    synth.finishCurrent(); // verse 1 -> verse 2
    synth.finishCurrent(); // verse 2 -> finish()
    await vi.runAllTicks();
    expect(wake.active).toBe(0);
    expect(wake.releases).toBeGreaterThanOrEqual(1);
  });

  it('releases the wake lock when stopped (cleanup)', async () => {
    const cleanup = speakChapter({ bookName: 'Genesis', chapter: 1, verses });
    await vi.runAllTicks();
    cleanup();
    await vi.runAllTicks();
    expect(wake.active).toBe(0);
  });

  it('re-acquires the wake lock when the tab becomes visible again', async () => {
    speakChapter({ bookName: 'Genesis', chapter: 1, verses });
    await vi.runAllTicks();
    expect(wake.requests).toBe(1);

    // Tab hidden: the browser auto-releases the lock and fires the sentinel's
    // 'release' event (the real platform behavior our handler relies on).
    setVisibility('hidden');
    wake.last._platformRelease();

    // Tab visible again: our visibilitychange handler must take the lock back.
    setVisibility('visible');
    await vi.runAllTicks();
    expect(wake.requests).toBe(2);
    expect(wake.active).toBe(1);
  });

  it('releases on pause and re-acquires on resume via MediaSession', async () => {
    const playbackStates = [];
    speakChapter({
      bookName: 'Genesis',
      chapter: 1,
      verses,
      onPlaybackStateChange: (state) => playbackStates.push(state),
    });
    await vi.runAllTicks();
    expect(wake.active).toBe(1);

    mediaSessionHandlers.pause();
    await vi.runAllTicks();
    expect(wake.active).toBe(0);
    expect(synth.paused).toBe(true);
    expect(playbackStates).toEqual(['paused']);

    mediaSessionHandlers.play();
    await vi.runAllTicks();
    expect(wake.active).toBe(1);
    expect(wake.requests).toBe(2);
    expect(synth.paused).toBe(false);
    expect(playbackStates).toEqual(['paused', 'playing']);
  });

  it('keeps a user pause active when the heartbeat runs', async () => {
    const controller = speakChapter({ bookName: 'Genesis', chapter: 1, verses });
    await vi.runAllTicks();

    expect(controller.pause()).toBe(true);
    expect(controller.isPaused()).toBe(true);
    expect(synth.paused).toBe(true);

    await vi.advanceTimersByTimeAsync(30000);

    expect(controller.isPaused()).toBe(true);
    expect(synth.paused).toBe(true);
    expect(wake.active).toBe(0);

    expect(controller.resume()).toBe(true);
    await vi.runAllTicks();
    expect(controller.isPaused()).toBe(false);
    expect(synth.paused).toBe(false);
    expect(wake.active).toBe(1);
  });

  it('releases a wake lock request that resolves after playback is paused', async () => {
    let resolveRequest;
    navigator.wakeLock.request = vi.fn(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const release = vi.fn(async () => {});
    const controller = speakChapter({ bookName: 'Genesis', chapter: 1, verses });

    controller.pause();
    resolveRequest({
      release,
      addEventListener: vi.fn(),
    });
    await vi.runAllTicks();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the Wake Lock API is unavailable', async () => {
    delete navigator.wakeLock;
    expect(() => {
      const cleanup = speakChapter({ bookName: 'Genesis', chapter: 1, verses });
      cleanup();
    }).not.toThrow();
  });

  it('announces the chapter only before the first verse', () => {
    speakChapter({ bookName: 'Genesis', chapter: 1, verses });

    expect(synth._utterances[0].text).toBe('Genesis 1, verse 1. In the beginning');
    synth.finishCurrent();
    expect(synth._utterances[1].text).toBe('verse 2. And the earth was without form');
  });

  it('reports MediaSession stop separately from natural completion', () => {
    const onStop = vi.fn();
    const onComplete = vi.fn();
    speakChapter({ bookName: 'Genesis', chapter: 1, verses, onStop, onComplete });

    mediaSessionHandlers.stop();

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(synth.speaking).toBe(false);
  });

  it('reports an unexpected interrupted utterance as an error', () => {
    const onError = vi.fn();
    speakChapter({ bookName: 'Genesis', chapter: 1, verses, onError });

    synth.errorCurrent('interrupted');

    expect(onError).toHaveBeenCalledWith('interrupted');
    expect(navigator.mediaSession.playbackState).toBe('none');
  });
});
