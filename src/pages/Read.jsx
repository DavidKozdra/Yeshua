import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  StickyNote,
  ExternalLink,
  X,
  Plus,
  Search,
  Volume2,
  Square,
} from 'lucide-react';
import { BIBLE_BOOKS, getBookById, getTranslationById } from '../utils/bibleData';
import { fetchChapter, resolveInstallableTranslationId } from '../utils/api';
import {
  getNotesForChapter,
  saveNote,
  deleteNote,
  getAllDownloadedTranslations,
  getChapter,
  getTranslationMeta,
} from '../utils/db';
import { saveLastRead, getLastRead, saveSettings } from '../utils/storage';
import { DEFAULT_TRANSLATION_ID, FALLBACK_TRANSLATION_ID } from '../utils/translationConfig';
import {
  isTextToSpeechSupported,
  speakChapter,
  stopTextToSpeech,
  TTS_RATE_OPTIONS,
  isSpeechAutoplayUnlocked,
  unlockSpeechAutoplay,
  pauseSpeechSynthesis,
  resumeSpeechSynthesis,
} from '../utils/tts';
import { createPortal } from 'react-dom';
import { useAppSettings } from '../hooks/useAppSettings';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getWordsOfChristSegments } from '../utils/redLetters';
import GlobalSearchBar from '../components/GlobalSearchBar';
import '../styles/read.css';

const AUTO_READ_STORAGE_KEY = 'yeshua-auto-read-state';
const AUTOPLAY_BLOCKED_MESSAGE =
  'Text-to-speech autoplay is blocked by your browser. Tap the read button to continue.';

function readAutoReadState() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return { isActive: false, pendingKey: null };
  }

  try {
    const stored = window.sessionStorage.getItem(AUTO_READ_STORAGE_KEY);
    if (!stored) {
      return { isActive: false, pendingKey: null };
    }
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return { isActive: false, pendingKey: null };
    }
    return {
      isActive: Boolean(parsed.isActive),
      pendingKey: typeof parsed.pendingKey === 'string' ? parsed.pendingKey : null,
    };
  } catch {
    return { isActive: false, pendingKey: null };
  }
}

function persistAutoReadState({ isActive, pendingKey }) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  if (isActive && pendingKey) {
    window.sessionStorage.setItem(
      AUTO_READ_STORAGE_KEY,
      JSON.stringify({ isActive: true, pendingKey })
    );
  } else {
    window.sessionStorage.removeItem(AUTO_READ_STORAGE_KEY);
  }
}

export default function Read() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();
  const lastRead = getLastRead();
  const resolvedBook = getBookById(params.bookId || lastRead?.bookId || 'JHN') || getBookById('JHN');
  const parsedChapter = Number.parseInt(params.chapter ?? '', 10);
  const resolvedChapter = Number.isNaN(parsedChapter) ? lastRead?.chapter || 1 : parsedChapter;
  const resolvedTranslation =
    getTranslationById(params.translationId || settings.defaultTranslation || lastRead?.translationId) ||
    getTranslationById(settings.defaultTranslation) ||
    getTranslationById(DEFAULT_TRANSLATION_ID) ||
    getTranslationById(FALLBACK_TRANSLATION_ID);

  const translationId = resolvedTranslation.id;
  const bookId = resolvedBook.id;
  const chapter = Math.min(Math.max(resolvedChapter, 1), resolvedBook.chapters);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chapterNotes, setChapterNotes] = useState([]);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showReaderActions, setShowReaderActions] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [isSpeakingChapter, setIsSpeakingChapter] = useState(false);
  const [speakingVerse, setSpeakingVerse] = useState(null);
  const [speechError, setSpeechError] = useState('');
  const [offlineState, setOfflineState] = useState({
    ready: false,
    message: 'Preparing your offline Bible library...',
    progress: null,
  });
  const initialAutoState = readAutoReadState();
  const [isAutoReadingBible, setIsAutoReadingBible] = useState(initialAutoState.isActive);
  const [pendingAutoStartKey, setPendingAutoStartKey] = useState(initialAutoState.pendingKey);
  const [speechAutoplayUnlocked, setSpeechAutoplayUnlocked] = useState(
    () => isSpeechAutoplayUnlocked()
  );
  const [speechVolume, setSpeechVolume] = useState(1);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [overlayContainer, setOverlayContainer] = useState(null);
  const contentRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const [chapterTransition, setChapterTransition] = useState({
    direction: null,
    animating: false,
  });
  const speechCleanupRef = useRef(null);
  const isAutoReadingBibleRef = useRef(isAutoReadingBible);
  const touchGestureRef = useRef(null);
  const noteModalRef = useFocusTrap(showNoteModal);
  const bookSelectorRef = useFocusTrap(showBookSelector);
  const chapterSelectorRef = useFocusTrap(showChapterSelector);
  const speechAutoplayUnlockedRef = useRef(speechAutoplayUnlocked);

  const book = resolvedBook;
  const translation = resolvedTranslation;
  const textToSpeechSupported = isTextToSpeechSupported();
  const textToSpeechSpeedLabel =
    TTS_RATE_OPTIONS.find((option) => option.value === settings.textToSpeechRate)?.label ||
    'Normal';

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function syncOfflineState() {
      const downloadedTranslations = await getAllDownloadedTranslations();
      if (cancelled) return false;

      setAvailableTranslations(downloadedTranslations);

      const translationReady = downloadedTranslations.some((item) => item.id === translationId);
      const cachedChapter = await getChapter(translationId, bookId, chapter);
      if (cancelled) return false;

      if (!translationReady && downloadedTranslations.length > 0 && !cachedChapter) {
        const fallbackTranslation =
          downloadedTranslations.find((item) => item.id === settings.defaultTranslation) ||
          downloadedTranslations[0];

        if (fallbackTranslation && fallbackTranslation.id !== translationId) {
          navigate(`/read/${fallbackTranslation.id}/${bookId}/${chapter}`, { replace: true });
          return false;
        }
      }

      if (translationReady || cachedChapter) {
        setOfflineState({ ready: true, message: '', progress: null });
        return false;
      }

      const startupTranslationId = resolveInstallableTranslationId();
      const startupTranslation = startupTranslationId
        ? getTranslationById(startupTranslationId)
        : null;
      const startupMeta = startupTranslationId
        ? await getTranslationMeta(startupTranslationId)
        : null;
      if (cancelled) return false;

      setOfflineState({
        ready: false,
        message: startupMeta?.inProgress
          ? `Preparing ${startupTranslation?.abbreviation || 'your offline Bible library'}...`
          : downloadedTranslations.length === 0
            ? startupTranslation
              ? `${startupTranslation.abbreviation} is installed by default in this build.`
              : 'Download a translation to start reading offline.'
            : `${translation.abbreviation} is not downloaded yet.`,
        progress: startupMeta?.totalChapters
          ? {
              done: startupMeta.completedChapters ?? 0,
              total: startupMeta.totalChapters,
            }
          : null,
      });

      return Boolean(startupMeta?.inProgress);
    }

    async function watchOfflineState() {
      let shouldPoll = true;

      while (!cancelled && shouldPoll) {
        shouldPoll = await syncOfflineState();
        if (!shouldPoll || cancelled) break;

        await new Promise((resolve) => {
          timeoutId = window.setTimeout(resolve, 1200);
        });
      }
    }

    watchOfflineState();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    translationId,
    bookId,
    chapter,
    settings.defaultTranslation,
    navigate,
    translation.abbreviation,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    setOverlayContainer(container);

    return () => {
      document.body.removeChild(container);
    };
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    speechAutoplayUnlockedRef.current = speechAutoplayUnlocked;
  }, [speechAutoplayUnlocked]);

  useEffect(() => {
    isAutoReadingBibleRef.current = isAutoReadingBible;
  }, [isAutoReadingBible]);

  useEffect(() => {
    if (!speechAutoplayUnlocked && isSpeechAutoplayUnlocked()) {
      setSpeechAutoplayUnlocked(true);
    }
  }, [speechAutoplayUnlocked]);

  useEffect(() => {
    if (
      !isAutoReadingBible ||
      !pendingAutoStartKey ||
      !offlineState.ready ||
      loading ||
      error ||
      isSpeakingChapter ||
      !verses.length ||
      !textToSpeechSupported ||
      !settings.showTextToSpeechTool
    ) {
      return;
    }

    if (!speechAutoplayUnlocked) {
      setSpeechError(AUTOPLAY_BLOCKED_MESSAGE);
      return;
    }

    const currentKey = `${bookId}:${chapter}`;
    if (pendingAutoStartKey !== currentKey) {
      return;
    }

    setPendingAutoStartKey(null);
    persistAutoReadState({ isActive: true, pendingKey: null });
    handleStartTextToSpeech({ autoAdvanceBible: true });
    }, [
      isAutoReadingBible,
      pendingAutoStartKey,
      offlineState.ready,
      loading,
      error,
      isSpeakingChapter,
      verses.length,
      textToSpeechSupported,
      settings.showTextToSpeechTool,
      settings.textToSpeechRate,
      settings.announceChapterNumbers,
      settings.announceVerseNumbers,
      bookId,
      chapter,
      speechAutoplayUnlocked,
    ]);

  const loadChapter = useCallback(async () => {
    if (!offlineState.ready) {
      setVerses([]);
      setChapterNotes([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchChapter(translationId, bookId, chapter, { offlineOnly: true });
      setVerses(data);
      saveLastRead({ translationId, bookId, chapter });
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
    } catch (err) {
      setVerses([]);
      setChapterNotes([]);
      setError(err.message);
    }
    setLoading(false);
  }, [offlineState.ready, translationId, bookId, chapter]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [bookId, chapter]);

  useEffect(() => {
    setIsSpeakingChapter(false);
    setSpeakingVerse(null);
    setSpeechError('');
    setIsSpeechPaused(false);

    return () => {
      if (speechCleanupRef.current) {
        speechCleanupRef.current();
        speechCleanupRef.current = null;
      } else {
        stopTextToSpeech();
      }
    };
  }, [translationId, bookId, chapter]);

  useEffect(() => {
    const verseMatch = location.hash.match(/^#v(\d+)$/i);
    if (!verseMatch || loading || error || !offlineState.ready || !verses.length) {
      if (!verseMatch) {
        setHighlightedVerse(null);
      }
      return;
    }

    const targetVerse = Number.parseInt(verseMatch[1], 10);
    if (Number.isNaN(targetVerse)) return;

    const targetElement = contentRef.current?.querySelector(`[data-verse="${targetVerse}"]`);
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedVerse(targetVerse);

    const timeoutId = window.setTimeout(() => {
      setHighlightedVerse((current) => (current === targetVerse ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.hash, verses, loading, error, offlineState.ready]);

  function goTo(newBook, newChapter, newTranslation = translationId) {
    navigate(`/read/${newTranslation}/${newBook}/${newChapter}`, { replace: true });
  }

  function getBookIndex(bookIdToFind) {
    return BIBLE_BOOKS.findIndex((book) => book.id === bookIdToFind);
  }

  function getNextChapterTarget(currentBookId, currentChapter) {
    const index = getBookIndex(currentBookId);
    if (index === -1) return null;
    if (currentChapter < BIBLE_BOOKS[index].chapters) {
      return { bookId: currentBookId, chapter: currentChapter + 1 };
    }
    if (index < BIBLE_BOOKS.length - 1) {
      const nextBook = BIBLE_BOOKS[index + 1];
      return { bookId: nextBook.id, chapter: 1 };
    }
    return null;
  }

  function getPrevChapterTarget(currentBookId, currentChapter) {
    const index = getBookIndex(currentBookId);
    if (index === -1) return null;
    if (currentChapter > 1) {
      return { bookId: currentBookId, chapter: currentChapter - 1 };
    }
    if (index > 0) {
      const prevBook = BIBLE_BOOKS[index - 1];
      return { bookId: prevBook.id, chapter: prevBook.chapters };
    }
    return null;
  }

  function navigateWithTransition(direction, navigateFn) {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setChapterTransition({ direction, animating: true });
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      navigateFn();
      if (isMountedRef.current) {
        setChapterTransition({ direction: null, animating: false });
      }
    }, 220);
  }

  function prevChapter() {
    const target = getPrevChapterTarget(bookId, chapter);
    if (target) {
      navigateWithTransition('prev', () => goTo(target.bookId, target.chapter));
    }
  }

  function nextChapter() {
    const target = getNextChapterTarget(bookId, chapter);
    if (target) {
      navigateWithTransition('next', () => goTo(target.bookId, target.chapter));
    }
  }

  function handleContentTouchStart(event) {
    if (
      showBookSelector ||
      showChapterSelector ||
      showNoteModal ||
      showReaderActions ||
      loading ||
      error ||
      !offlineState.ready ||
      event.touches.length !== 1
    ) {
      touchGestureRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchGestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: Date.now(),
    };
  }

  function handleContentTouchEnd(event) {
    if (!touchGestureRef.current || event.changedTouches.length !== 1) {
      touchGestureRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchGestureRef.current.x;
    const deltaY = touch.clientY - touchGestureRef.current.y;
    const elapsedMs = Date.now() - touchGestureRef.current.startedAt;
    touchGestureRef.current = null;

    if (elapsedMs > 700) return;
    if (Math.abs(deltaX) < 72) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    if (deltaX < 0) {
      nextChapter();
    } else {
      prevChapter();
    }
  }

  function versesWithNotes() {
    const noteMap = new Set();
    chapterNotes.forEach((n) => noteMap.add(n.verse));
    return noteMap;
  }

  function openNoteForVerse(verse) {
    setShowReaderActions(false);
    const existing = chapterNotes.find((n) => n.verse === verse);
    if (existing) {
      setNoteText(existing.text);
      setEditingNoteId(existing.id);
    } else {
      setNoteText('');
      setEditingNoteId(null);
    }
    setSelectedVerse(verse);
    setShowNoteModal(true);
  }

  function openQuickNoteModal() {
    setSelectedVerse(1);
    setNoteText('');
    setEditingNoteId(null);
    setShowReaderActions(false);
    setShowNoteModal(true);
  }

  function handleSearchBarToggle() {
    saveSettings({
      ...settings,
      showGlobalSearchBar: !settings.showGlobalSearchBar,
    });
    setShowReaderActions(false);
  }

  function ensureSpeechAutoplayUnlocked() {
    if (speechAutoplayUnlockedRef.current) {
      return;
    }

    if (unlockSpeechAutoplay()) {
      setSpeechAutoplayUnlocked(true);
    }
  }

  function handleStopTextToSpeech() {
    if (speechCleanupRef.current) {
      speechCleanupRef.current();
      speechCleanupRef.current = null;
    } else {
      stopTextToSpeech();
    }

    setIsSpeakingChapter(false);
    setSpeakingVerse(null);
    setSpeechError('');
    setIsAutoReadingBible(false);
    setPendingAutoStartKey(null);
    persistAutoReadState({ isActive: false, pendingKey: null });
    setShowReaderActions(false);
    setIsSpeechPaused(false);
  }

  function handleToggleSpeechPause() {
    if (!isSpeakingChapter) {
      return;
    }

    if (isSpeechPaused) {
      resumeSpeechSynthesis();
      setIsSpeechPaused(false);
    } else {
      pauseSpeechSynthesis();
      setIsSpeechPaused(true);
    }
  }

  function handleSpeechVolumeChange(event) {
    const value = Number.parseFloat(event.target.value);
    if (Number.isNaN(value)) {
      return;
    }

    const normalized = Math.max(0, Math.min(value, 1));
    setSpeechVolume(normalized);
    speechCleanupRef.current?.setVolume?.(normalized);
  }

  function handleStartTextToSpeech({ autoAdvanceBible = false } = {}) {
    setShowReaderActions(false);

    if (!textToSpeechSupported) {
      setSpeechError('Text to speech is not available in this browser.');
      return;
    }

    if (!autoAdvanceBible) {
      ensureSpeechAutoplayUnlocked();
    }

    if (!offlineState.ready || loading || error || !verses.length) {
      setSpeechError('Load a chapter before starting text to speech.');
      return;
    }

    if (speechCleanupRef.current) {
      speechCleanupRef.current();
      speechCleanupRef.current = null;
    }

    setSpeechError('');
    if (!autoAdvanceBible) {
      setIsAutoReadingBible(false);
      setPendingAutoStartKey(null);
      persistAutoReadState({ isActive: false, pendingKey: null });
    }

    try {
      speechCleanupRef.current = speakChapter({
        bookName: book.name,
        chapter,
        verses,
        rate: settings.textToSpeechRate,
        announceChapterNumbers: settings.announceChapterNumbers,
        announceVerseNumbers: settings.announceVerseNumbers,
        voiceUri: settings.textToSpeechVoice,
        volume: speechVolume,
        onVerseStart: (verseNumber) => {
          setSpeakingVerse(verseNumber);
          const targetElement = contentRef.current?.querySelector(`[data-verse="${verseNumber}"]`);
          targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        onComplete: () => {
          speechCleanupRef.current = null;
          setIsSpeechPaused(false);
          setIsSpeakingChapter(false);
          setSpeakingVerse(null);
          if (autoAdvanceBible && isAutoReadingBibleRef.current) {
            const nextTarget = getNextChapterTarget(bookId, chapter);
            if (nextTarget) {
            setPendingAutoStartKey(`${nextTarget.bookId}:${nextTarget.chapter}`);
            persistAutoReadState({
              isActive: true,
              pendingKey: `${nextTarget.bookId}:${nextTarget.chapter}`,
            });
              goTo(nextTarget.bookId, nextTarget.chapter);
            } else {
              setIsAutoReadingBible(false);
              setPendingAutoStartKey(null);
              persistAutoReadState({ isActive: false, pendingKey: null });
            }
          }
        },
        onError: (message) => {
          speechCleanupRef.current = null;
          setIsSpeechPaused(false);
          setIsSpeakingChapter(false);
          setSpeakingVerse(null);
          setSpeechError(
            typeof message === 'string' && message.trim()
              ? message
              : 'Speech playback failed.'
          );
        },
      });
      setIsSpeakingChapter(true);
    } catch (err) {
      speechCleanupRef.current = null;
      setIsSpeechPaused(false);
      setIsSpeakingChapter(false);
      setSpeakingVerse(null);
      setSpeechError(err.message || 'Text to speech could not start.');
    }
  }

  function handleToggleBibleReading() {
    if (isAutoReadingBible) {
      handleStopTextToSpeech();
      return;
    }

    if (!textToSpeechSupported) {
      setSpeechError('Text to speech is not available in this browser.');
      return;
    }

    ensureSpeechAutoplayUnlocked();

    if (!offlineState.ready || loading || error) {
      setSpeechError('Load a chapter before starting text to speech.');
      return;
    }

    if (!settings.showTextToSpeechTool) {
      setSpeechError('Enable the text-to-speech tool in settings to read the entire Bible.');
      return;
    }

    if (speechCleanupRef.current) {
      speechCleanupRef.current();
      speechCleanupRef.current = null;
    }

    setSpeechError('');
    setIsAutoReadingBible(true);
    const startBookId = BIBLE_BOOKS[0]?.id || bookId;
    setPendingAutoStartKey(`${startBookId}:1`);
    persistAutoReadState({ isActive: true, pendingKey: `${startBookId}:1` });
    goTo(startBookId, 1);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    const note = {
      ...(editingNoteId ? { id: editingNoteId } : {}),
      translationId,
      bookId,
      chapter,
      verse: selectedVerse,
      verseKey: `${bookId}:${chapter}:${selectedVerse}`,
      bookChapter: `${bookId}:${chapter}`,
      text: noteText.trim(),
      createdAt: editingNoteId
        ? chapterNotes.find((n) => n.id === editingNoteId)?.createdAt
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveNote(note);
    setShowNoteModal(false);
    const notes = await getNotesForChapter(bookId, chapter);
    setChapterNotes(notes);
  }

  async function handleDeleteNote() {
    if (editingNoteId) {
      await deleteNote(editingNoteId);
      setShowNoteModal(false);
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
    }
  }

  const noteVerses = versesWithNotes();

  const ttsOverlayElement = isSpeakingChapter || speechError ? (
    <div className={`tts-overlay ${speechError ? 'is-error' : ''}`}>
      <div className="read-tts-copy">
        <Volume2 size={16} />
        <span>
          {isSpeakingChapter
            ? `Reading aloud at ${textToSpeechSpeedLabel.toLowerCase()} speed.`
            : speechError}
        </span>
      </div>
      {isSpeakingChapter && (
        <div className="read-tts-controls">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleToggleSpeechPause}
            aria-label={isSpeechPaused ? 'Resume text to speech' : 'Pause text to speech'}
          >
            {isSpeechPaused ? 'Resume' : 'Pause'}
          </button>
          <label className="read-tts-volume">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={speechVolume}
              onChange={handleSpeechVolumeChange}
              aria-label="Text to speech volume"
            />
          </label>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleStopTextToSpeech}
            aria-label="Stop text to speech"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  ) : null;

  const ttsOverlayPortal =
    overlayContainer && ttsOverlayElement ? createPortal(ttsOverlayElement, overlayContainer) : null;

  return (
    <>
      <div className="read-page">
      {/* Top bar */}
      <div className="read-topbar">
        <div className="read-selectors">
          <button
            className="selector-btn"
            onClick={() => {
              setShowBookSelector(true);
              setShowChapterSelector(false);
            }}
          >
            <BookOpen size={16} />
            <span>{book?.name || bookId}</span>
          </button>
          <button
            className="selector-btn"
            onClick={() => {
              setShowChapterSelector(true);
              setShowBookSelector(false);
            }}
          >
            <List size={16} />
            <span>Ch. {chapter}</span>
          </button>
          <select
            className="translation-select"
            value={translationId}
            aria-label="Bible translation"
            onChange={(e) => {
              goTo(bookId, chapter, e.target.value);
            }}
          >
            {/* Always show current translation */}
            {translation && (
              <option value={translationId}>{translation.abbreviation}</option>
            )}
            {availableTranslations
              .filter((t) => t.id !== translationId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbreviation}
                </option>
            ))}
          </select>
        </div>
        {settings.showGlobalSearchBar && (
          <GlobalSearchBar translationId={translationId} variant="inline" />
        )}
        <a
          href={`https://biblehub.com/${book?.name?.toLowerCase().replace(/\s+/g, '_') || bookId}/${chapter}.htm`}
          target="_blank"
          rel="noopener noreferrer"
          className="research-link"
          title="View commentaries on Bible Hub"
          aria-label="View commentaries on Bible Hub (opens in new tab)"
        >
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>

      {/* Book selector panel */}
      {showBookSelector && (
        <div
          className="selector-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Select Book"
          ref={bookSelectorRef}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowBookSelector(false); }}
        >
          <div className="selector-panel-header">
            <h3>Select Book</h3>
            <button aria-label="Close book selector" onClick={() => setShowBookSelector(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="selector-panel-content">
            <p className="section-label">Old Testament</p>
            <div className="book-grid">
              {BIBLE_BOOKS.filter((b) => b.testament === 'OT').map((b) => (
                <button
                  key={b.id}
                  className={`book-btn ${b.id === bookId ? 'active' : ''}`}
                  onClick={() => {
                    goTo(b.id, 1);
                    setShowBookSelector(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <p className="section-label" style={{ marginTop: '1rem' }}>New Testament</p>
            <div className="book-grid">
              {BIBLE_BOOKS.filter((b) => b.testament === 'NT').map((b) => (
                <button
                  key={b.id}
                  className={`book-btn ${b.id === bookId ? 'active' : ''}`}
                  onClick={() => {
                    goTo(b.id, 1);
                    setShowBookSelector(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chapter selector panel */}
      {showChapterSelector && (
        <div
          className="selector-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`Select Chapter for ${book?.name}`}
          ref={chapterSelectorRef}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowChapterSelector(false); }}
        >
          <div className="selector-panel-header">
            <h3>{book?.name} - Select Chapter</h3>
            <button aria-label="Close chapter selector" onClick={() => setShowChapterSelector(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="chapter-grid">
            {Array.from({ length: book?.chapters || 0 }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                className={`chapter-btn ${ch === chapter ? 'active' : ''}`}
                onClick={() => {
                  goTo(bookId, ch);
                  setShowChapterSelector(false);
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bible text */}
      <div
        className={`read-content${chapterTransition.animating ? ` is-turning-${chapterTransition.direction}` : ''}`}
        ref={contentRef}
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
        onTouchCancel={() => {
          touchGestureRef.current = null;
        }}
      >
        <h2 className="chapter-heading">
          {book?.name} {chapter}
        </h2>


        {loading && <div className="loading-spinner" role="status" aria-live="polite">Loading...</div>}
        {!loading && !offlineState.ready && (
          <div className="read-empty-state" role="status" aria-live="polite">
            <p>{offlineState.message}</p>
            {offlineState.progress && (
              <div className="download-progress read-progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={offlineState.progress.done}
                  aria-valuemin={0}
                  aria-valuemax={offlineState.progress.total}
                  aria-label={`Download progress: ${offlineState.progress.done} of ${offlineState.progress.total} chapters saved`}
                >
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${
                        offlineState.progress.total
                          ? (offlineState.progress.done / offlineState.progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="progress-text">
                  {offlineState.progress.done} / {offlineState.progress.total} chapters saved
                </span>
              </div>
            )}
            <div className="read-empty-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/translations')}>
                Open Translations
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="read-error" role="alert">
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={loadChapter}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && offlineState.ready && (
          <div
            className={`verses ${settings.oneVersePerLine ? 'verses-stacked' : ''}`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
            }}
          >
            {verses.map((v) => {
              const verseSegments = settings.showWordsOfChristInRed
                ? getWordsOfChristSegments({
                    translationId,
                    bookId,
                    chapter,
                    verse: v.verse,
                    text: v.text,
                    allowVerseFallback: settings.useVerseRedLetterFallback,
                  })
                : null;

              return (
                <span
                  key={v.verse}
                  className={`verse ${noteVerses.has(v.verse) ? 'has-note' : ''} ${
                    highlightedVerse === v.verse ? 'verse-targeted' : ''
                  } ${speakingVerse === v.verse ? 'verse-speaking' : ''}`}
                  data-verse={v.verse}
                  onClick={() => openNoteForVerse(v.verse)}
                >
                  {settings.showVerseNumbers && (
                    <sup className="verse-num">{v.verse}</sup>
                  )}
                  {verseSegments
                    ? verseSegments.map((segment, index) => (
                        <span
                          key={`${v.verse}-${index}`}
                          className={segment.isRed ? 'verse-christ-words' : undefined}
                        >
                          {segment.text}
                        </span>
                      ))
                    : v.text}
                  {!settings.oneVersePerLine && ' '}
                </span>
              );
            })}
          </div>
        )}

        {/* Chapter navigation */}
        {offlineState.ready && !error && (
          <nav className="chapter-nav" aria-label="Chapter navigation">
            <button className="btn btn-outline" onClick={prevChapter} aria-label="Previous chapter">
              <ChevronLeft size={18} aria-hidden="true" />
              Previous
            </button>
            <button className="btn btn-outline" onClick={nextChapter} aria-label="Next chapter">
              Next
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>

      {/* Note modal */}
      {showNoteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowNoteModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowNoteModal(false); }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Note for ${book?.name} ${chapter}:${selectedVerse}`}
            ref={noteModalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              <StickyNote size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} aria-hidden="true" />
              {book?.name} {chapter}:{selectedVerse}
            </h2>
            <label htmlFor="note-text" className="sr-only">Note text</label>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              autoFocus
              style={{ width: '100%' }}
            />
            <div className="modal-actions">
              {editingNoteId && (
                <button className="btn btn-danger btn-sm" onClick={handleDeleteNote}>
                  Delete
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setShowNoteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>
                {editingNoteId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating add note button */}
      <div className="fab-menu">
        {showReaderActions && (
          <div className="fab-menu-actions">
            {settings.showTextToSpeechTool && textToSpeechSupported && (
              <button
                className="fab-action"
                onClick={isSpeakingChapter ? handleStopTextToSpeech : handleStartTextToSpeech}
              >
                {isSpeakingChapter ? <Square size={16} /> : <Volume2 size={16} />}
                <span>{isSpeakingChapter ? 'Stop reading' : 'Read chapter aloud'}</span>
              </button>
            )}
            <button className="fab-action" onClick={openQuickNoteModal}>
              <StickyNote size={16} />
              <span>Add note</span>
            </button>
            <button className="fab-action" onClick={handleSearchBarToggle}>
              <Search size={16} />
              <span>{settings.showGlobalSearchBar ? 'Hide search bar' : 'Show search bar'}</span>
            </button>
          </div>
        )}
        <button
          className={`fab ${showReaderActions ? 'fab-open' : ''}`}
          onClick={() => setShowReaderActions((current) => !current)}
          aria-label={showReaderActions ? 'Close reader tools' : 'Open reader tools'}
          aria-expanded={showReaderActions}
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>
      </div>
      {ttsOverlayPortal}
    </>
  );
}
