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

export function isTextToSpeechSupported() {
  return Boolean(getSpeechSynthesis() && typeof window.SpeechSynthesisUtterance !== 'undefined');
}

export function stopTextToSpeech() {
  const synth = getSpeechSynthesis();
  if (!synth) return;
  synth.cancel();
}

export function speakChapter({
  bookName,
  chapter,
  verses,
  rate = 1,
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

  function finish() {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    onComplete?.();
  }

  function speakAt(index) {
    if (cancelled) return;

    const verse = queue[index];
    if (!verse) {
      finish();
      return;
    }

    onVerseStart?.(verse.verse);

    const utterance = new window.SpeechSynthesisUtterance(
      `${bookName} ${chapter}, verse ${verse.verse}. ${verse.text}`
    );
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
      onError?.(event.error || 'Speech playback failed.');
    };

    synth.speak(utterance);
  }

  speakAt(0);

  return () => {
    if (cancelled) return;
    cancelled = true;
    activeUtterance = null;
    synth.cancel();
  };
}
