export const TTS_RATE_OPTIONS = [
  { value: 0.85, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Fast' },
  { value: 1.3, label: 'Faster' },
];

export const DEFAULT_TEXT_TO_SPEECH_VOICE = '';
export const DEFAULT_TEXT_TO_SPEECH_VOLUME = 1;

const LANGUAGE_CODE_BY_NAME = {
  english: 'en',
  spanish: 'es',
};
const DEFAULT_SPEECH_PITCH = 1;
const MAX_SPEECH_CHUNK_LENGTH = 180;

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

function getVoiceId(voice, index = 0) {
  if (!voice) return `${DEFAULT_TEXT_TO_SPEECH_VOICE}-${index}`;
  return voice.voiceURI || `${voice.name}-${voice.lang}-${index}`;
}

function getRawVoices() {
  const synth = getSpeechSynthesis();
  if (!synth) return [];
  return synth.getVoices();
}

function normalizeVoiceOption(voice, index) {
  return {
    id: getVoiceId(voice, index),
    name: voice.name,
    lang: voice.lang || '',
    label: `${voice.name}${voice.lang ? ` (${voice.lang})` : ''}${voice.default ? ' - Default' : ''}`,
    default: Boolean(voice.default),
    localService: Boolean(voice.localService),
  };
}

export function getTextToSpeechVoices() {
  return getRawVoices()
    .map((voice, index) => normalizeVoiceOption(voice, index))
    .sort((a, b) => Number(b.default) - Number(a.default) || a.label.localeCompare(b.label));
}

export function subscribeToTextToSpeechVoices(listener) {
  const synth = getSpeechSynthesis();
  if (!synth) {
    listener([]);
    return () => {};
  }

  const emit = () => {
    listener(getTextToSpeechVoices());
  };

  emit();

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', emit);
    return () => {
      synth.removeEventListener('voiceschanged', emit);
    };
  }

  const previousHandler = synth.onvoiceschanged;
  const nextHandler = () => {
    previousHandler?.call(synth);
    emit();
  };

  synth.onvoiceschanged = nextHandler;

  return () => {
    if (synth.onvoiceschanged === nextHandler) {
      synth.onvoiceschanged = previousHandler || null;
    }
  };
}

export function normalizeTextToSpeechVolume(value) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  if (Number.isNaN(parsedValue)) return DEFAULT_TEXT_TO_SPEECH_VOLUME;

  return Math.min(1, Math.max(0.1, Math.round(parsedValue * 100) / 100));
}

function normalizeLanguageCode(language) {
  if (typeof language !== 'string') return '';

  const trimmedLanguage = language.trim();
  if (!trimmedLanguage) return '';
  if (/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(trimmedLanguage)) {
    return trimmedLanguage;
  }

  return LANGUAGE_CODE_BY_NAME[trimmedLanguage.toLowerCase()] || '';
}

function resolveSpeechVoice(voiceId, voices) {
  if (!voiceId) return null;

  const matchIndex = voices.findIndex((voice, index) => getVoiceId(voice, index) === voiceId);
  return matchIndex >= 0 ? voices[matchIndex] : null;
}

function filterVoicesByLanguage(voices, language) {
  const normalizedLanguage = normalizeLanguageCode(language).toLowerCase();
  if (!normalizedLanguage) return [...voices];

  const exactMatches = voices.filter((voice) => voice.lang?.toLowerCase() === normalizedLanguage);
  if (exactMatches.length > 0) return exactMatches;

  const prefixMatches = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith(`${normalizedLanguage}-`)
  );
  if (prefixMatches.length > 0) return prefixMatches;

  const languagePrefix = normalizedLanguage.split('-')[0];
  const broadMatches = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith(languagePrefix)
  );
  if (broadMatches.length > 0) return broadMatches;

  return [];
}

function sortVoiceCandidates(voices) {
  return [...voices].sort(
    (a, b) =>
      Number(Boolean(b.localService)) - Number(Boolean(a.localService)) ||
      Number(Boolean(b.default)) - Number(Boolean(a.default)) ||
      a.name.localeCompare(b.name)
  );
}

function buildVoiceCandidates(voices, preferredVoiceId, language) {
  const queue = [];
  const seen = new Set();

  function pushVoice(voice) {
    const key = voice ? voice.voiceURI || `${voice.name}-${voice.lang}` : 'system-default';
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(voice);
  }

  const selectedVoice = resolveSpeechVoice(preferredVoiceId, voices);
  if (selectedVoice) {
    pushVoice(selectedVoice);
  }

  const matchingVoices = sortVoiceCandidates(filterVoicesByLanguage(voices, language));
  matchingVoices.forEach(pushVoice);

  const localVoices = sortVoiceCandidates(voices.filter((voice) => voice.localService));
  localVoices.forEach(pushVoice);

  sortVoiceCandidates(voices).forEach(pushVoice);
  pushVoice(null);

  return queue;
}

function resolveSpeechLanguage(voice, language, { explicit = false } = {}) {
  if (voice?.lang) return voice.lang;
  if (!explicit) return '';

  const normalizedLanguage = normalizeLanguageCode(language);
  if (normalizedLanguage) {
    return normalizedLanguage;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language;
  }

  return '';
}

function splitSpeechText(text) {
  const normalizedText = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
  if (!normalizedText) return [];
  if (normalizedText.length <= MAX_SPEECH_CHUNK_LENGTH) return [normalizedText];

  const segments = normalizedText.match(/[^.!?;:]+[.!?;:]?|\S+/g) || [normalizedText];
  const chunks = [];
  let currentChunk = '';

  segments.forEach((segment) => {
    const nextSegment = segment.trim();
    if (!nextSegment) return;

    const candidate = currentChunk ? `${currentChunk} ${nextSegment}` : nextSegment;
    if (candidate.length <= MAX_SPEECH_CHUNK_LENGTH) {
      currentChunk = candidate;
      return;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (nextSegment.length <= MAX_SPEECH_CHUNK_LENGTH) {
      currentChunk = nextSegment;
      return;
    }

    const words = nextSegment.split(/\s+/);
    let wordChunk = '';
    words.forEach((word) => {
      const wordCandidate = wordChunk ? `${wordChunk} ${word}` : word;
      if (wordCandidate.length <= MAX_SPEECH_CHUNK_LENGTH) {
        wordChunk = wordCandidate;
      } else {
        if (wordChunk) {
          chunks.push(wordChunk);
        }
        wordChunk = word;
      }
    });
    currentChunk = wordChunk;
  });

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildSpeechQueue({ bookName, chapter, verses }) {
  return (Array.isArray(verses) ? verses : [])
    .filter((verse) => typeof verse?.text === 'string' && verse.text.trim())
    .flatMap((verse) => {
      const chunks = splitSpeechText(verse.text);
      return chunks.map((chunk, index) => ({
        verse: verse.verse,
        text:
          index === 0
            ? `${bookName} ${chapter}, verse ${verse.verse}. ${chunk}`
            : chunk,
        announceVerseStart: index === 0,
      }));
    });
}

function buildSampleSpeechQueue(text) {
  const chunks = splitSpeechText(text);
  return chunks.map((chunk) => ({
    verse: null,
    text: chunk,
    announceVerseStart: false,
  }));
}

function waitForVoices(timeoutMs = 1200) {
  const synth = getSpeechSynthesis();
  if (!synth) return Promise.resolve([]);

  const existingVoices = getRawVoices();
  if (existingVoices.length > 0) {
    return Promise.resolve(existingVoices);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', handleVoicesChanged);
      } else if (synth.onvoiceschanged === handleVoicesChanged) {
        synth.onvoiceschanged = null;
      }
      window.clearTimeout(timeoutId);
      resolve(getRawVoices());
    };

    const handleVoicesChanged = () => {
      if (getRawVoices().length > 0) {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, timeoutMs);

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', handleVoicesChanged);
    } else {
      synth.onvoiceschanged = handleVoicesChanged;
    }
  });
}

function formatSpeechError(errorCode, { voiceName, hadSelectedVoice, didRetryDefaultVoice }) {
  if (errorCode === 'synthesis-failed') {
    if (hadSelectedVoice && didRetryDefaultVoice) {
      return `The selected voice "${voiceName}" failed, and the available fallback voices failed too. Try another voice or a slower speed.`;
    }

    if (hadSelectedVoice) {
      return `The selected voice "${voiceName}" failed. Try System Default or a slower speed.`;
    }

    return 'Speech synthesis failed with the available voices. Try another voice or a slower speed.';
  }

  if (errorCode === 'audio-busy') {
    return 'Text to speech is busy right now. Stop the current playback and try again.';
  }

  if (errorCode === 'not-allowed') {
    return 'Text to speech was blocked by the browser. Start it from a direct tap or click.';
  }

  return 'Speech playback failed.';
}

function speakQueue({
  queue,
  rate = 1,
  volume = DEFAULT_TEXT_TO_SPEECH_VOLUME,
  voiceId = DEFAULT_TEXT_TO_SPEECH_VOICE,
  language = 'en-US',
  onItemStart,
  onComplete,
  onError,
}) {
  const synth = getSpeechSynthesis();
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') {
    throw new Error('Text-to-speech is not available in this browser.');
  }

  if (queue.length === 0) {
    onComplete?.();
    return () => {};
  }

  synth.cancel();

  let cancelled = false;
  let activeUtterance = null;
  const normalizedVolume = normalizeTextToSpeechVolume(volume);
  let selectedVoice = null;
  let voiceCandidates = [null];

  function finish() {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    onComplete?.();
  }

  function speakAt(index, voiceCandidateIndex = 0) {
    if (cancelled) return;

    const item = queue[index];
    if (!item) {
      finish();
      return;
    }

    onItemStart?.(item);

    const utterance = new window.SpeechSynthesisUtterance(item.text);
    const activeVoice = voiceCandidates[voiceCandidateIndex] ?? null;
    if (activeVoice) {
      utterance.voice = activeVoice;
    }
    const resolvedLanguage = resolveSpeechLanguage(activeVoice, language, {
      explicit: Boolean(activeVoice),
    });
    if (resolvedLanguage) {
      utterance.lang = resolvedLanguage;
    }
    utterance.rate = rate;
    utterance.pitch = DEFAULT_SPEECH_PITCH;
    utterance.volume = normalizedVolume;
    activeUtterance = utterance;

    utterance.onend = () => {
      if (cancelled || activeUtterance !== utterance) return;
      window.setTimeout(() => {
        speakAt(index + 1);
      }, 0);
    };

    utterance.onerror = (event) => {
      if (cancelled || activeUtterance !== utterance) return;

      const errorCode = event.error || 'speech-failed';
      if (errorCode === 'synthesis-failed' && voiceCandidateIndex < voiceCandidates.length - 1) {
        activeUtterance = null;
        window.setTimeout(() => {
          speakAt(index, voiceCandidateIndex + 1);
        }, 0);
        return;
      }

      cancelled = true;
      activeUtterance = null;
      onError?.({
        code: errorCode,
        verse: item.verse,
        message: formatSpeechError(errorCode, {
          voiceName: selectedVoice?.name || 'System Default',
          hadSelectedVoice: Boolean(selectedVoice),
          didRetryDefaultVoice: voiceCandidateIndex > 0,
        }),
      });
    };

    synth.resume?.();
    synth.speak(utterance);
  }

  waitForVoices()
    .then((voices) => {
      if (cancelled) return;

      selectedVoice = resolveSpeechVoice(voiceId, voices);
      voiceCandidates = buildVoiceCandidates(voices, voiceId, language);

      window.setTimeout(() => {
        if (!cancelled) {
          speakAt(0);
        }
      }, 0);
    })
    .catch(() => {
      if (cancelled) return;
      speakAt(0);
    });

  return () => {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    synth.cancel();
  };
}

export function speakChapter({
  bookName,
  chapter,
  verses,
  rate = 1,
  volume = DEFAULT_TEXT_TO_SPEECH_VOLUME,
  voiceId = DEFAULT_TEXT_TO_SPEECH_VOICE,
  language = 'en-US',
  onVerseStart,
  onComplete,
  onError,
}) {
  return speakQueue({
    queue: buildSpeechQueue({ bookName, chapter, verses }),
    rate,
    volume,
    voiceId,
    language,
    onItemStart: (item) => {
      if (item.announceVerseStart && typeof item.verse === 'number') {
        onVerseStart?.(item.verse);
      }
    },
    onComplete,
    onError,
  });
}

export function speakTextSample({
  text = 'This is a text to speech test.',
  rate = 1,
  volume = DEFAULT_TEXT_TO_SPEECH_VOLUME,
  voiceId = DEFAULT_TEXT_TO_SPEECH_VOICE,
  language = 'en-US',
  onComplete,
  onError,
}) {
  return speakQueue({
    queue: buildSampleSpeechQueue(text),
    rate,
    volume,
    voiceId,
    language,
    onComplete,
    onError,
  });
}
