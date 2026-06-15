import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  StickyNote,
  Share2,
  ExternalLink,
  X,
  Plus,
  Search,
  Volume2,
  Square,
  Bookmark,
  Highlighter,
} from 'lucide-react';
import { BIBLE_BOOKS, getBookById, getTranslationById } from '../utils/bibleData';
import { fetchChapter, resolveInstallableTranslationId, getTranslationInstallSource } from '../utils/api';
import {
  getNotesForChapter,
  saveNote,
  deleteNote,
  getAllDownloadedTranslations,
  getChapter,
  getTranslationMeta,
  saveReadingProgress,
  saveBookmark,
  deleteBookmark,
  getBookmarks,
  saveHighlight,
  deleteHighlight,
  deleteHighlightsForTarget,
  getHighlightsForChapter,
} from '../utils/db';
import { saveLastRead, getLastRead, saveSettings } from '../utils/storage';
import { DEFAULT_TRANSLATION_ID, FALLBACK_TRANSLATION_ID } from '../utils/translationConfig';
import { useAppSettings } from '../hooks/useAppSettings';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useReadAloud } from '../components/ReadAloudProvider';
import {
  getNextBibleChapter,
  getPreviousBibleChapter,
} from '../utils/bibleNavigation';
import { getWordsOfChristSegments } from '../utils/redLetters';
import { dispatchAppToast } from '../utils/appToasts';
import { getExternalNavigationProps } from '../utils/externalLinks';
import {
  buildVerseLocation,
  createVerseSharePayload,
  getVerseTargetFromLocation,
  shareVersePayload,
} from '../utils/verseSharing';
import GlobalSearchBar from '../components/GlobalSearchBar';
import '../styles/read.css';

const TRANSLATION_FEEDBACK_DURATION_MS = 900;

export default function Read() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();
  const readAloud = useReadAloud();
  const externalNavigationProps = getExternalNavigationProps();
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
  const [noteModalContext, setNoteModalContext] = useState('verse');
  const [noteText, setNoteText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [isSavingVerseMarker, setIsSavingVerseMarker] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [offlineState, setOfflineState] = useState({
    ready: false,
    message: 'Preparing your offline Bible library...',
    progress: null,
  });
  const contentRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const translationFeedbackTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const [chapterTransition, setChapterTransition] = useState({
    direction: null,
    animating: false,
  });
  const [translationFeedbackActive, setTranslationFeedbackActive] = useState(false);
  const touchGestureRef = useRef(null);
  const noteModalRef = useFocusTrap(showNoteModal);
  const bookSelectorRef = useFocusTrap(showBookSelector);
  const chapterSelectorRef = useFocusTrap(showChapterSelector);

  const book = resolvedBook;
  const translation = resolvedTranslation;
  const textToSpeechSupported = readAloud.supported;
  const isSpeakingChapter =
    readAloud.isActive &&
    readAloud.translationId === translationId &&
    readAloud.bookId === bookId &&
    readAloud.chapter === chapter;
  const speakingVerse = isSpeakingChapter ? readAloud.verse : null;

  useLayoutEffect(() => {
    saveLastRead({ translationId, bookId, chapter });
  }, [translationId, bookId, chapter]);

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

      const installSource = getTranslationInstallSource(translationId);
      const isBundled = installSource === 'bundle';

      if (!translationReady && !isBundled && downloadedTranslations.length > 0 && !cachedChapter) {
        const fallbackTranslation =
          downloadedTranslations.find((item) => item.id === settings.defaultTranslation) ||
          downloadedTranslations[0];

        if (fallbackTranslation && fallbackTranslation.id !== translationId) {
          navigate(
            buildVerseLocation({
              translationId: fallbackTranslation.id,
              bookId,
              chapter,
              verse: getVerseTargetFromLocation(location),
            }),
            { replace: true }
          );
          return false;
        }
      }

      const startupTranslationId = resolveInstallableTranslationId();
      const startupTranslation = startupTranslationId
        ? getTranslationById(startupTranslationId)
        : null;
      const startupMeta = startupTranslationId
        ? await getTranslationMeta(startupTranslationId)
        : null;
      if (cancelled) return false;

      const progress = startupMeta?.totalChapters
        ? {
            done: startupMeta.completedChapters ?? 0,
            total: startupMeta.totalChapters,
          }
        : null;

      if (translationReady || cachedChapter || isBundled) {
        const readyMessage =
          isBundled && !translationReady && !cachedChapter
            ? `${translation.abbreviation || translationId.toUpperCase()} is included with this build and ready to read.`
            : '';

        setOfflineState({
          ready: true,
          message: readyMessage,
          progress,
        });

        return Boolean(startupMeta?.inProgress);
      }

      setOfflineState({
        ready: false,
        message: startupMeta?.inProgress
          ? `Preparing ${startupTranslation?.abbreviation || 'your offline Bible library'}...`
          : downloadedTranslations.length === 0
            ? startupTranslation
              ? `${startupTranslation.abbreviation} is installed by default in this build.`
              : 'Download a translation to start reading offline.'
            : `${translation.abbreviation} is not downloaded yet.`,
        progress,
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
    location.hash,
    location.search,
    translation.abbreviation,
  ]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (translationFeedbackTimerRef.current) {
        window.clearTimeout(translationFeedbackTimerRef.current);
      }
    };
  }, []);

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
      await saveReadingProgress({
        sourceType: 'bible',
        translationId,
        bookId,
        chapter,
        completedAt: new Date().toISOString(),
      });
      const notes = await getNotesForChapter(bookId, chapter);
      const chapterBookmarks = await getBookmarks({ sourceType: 'bible', bookId });
      const chapterHighlights = await getHighlightsForChapter({
        sourceType: 'bible',
        translationId,
        bookId,
        chapter,
      });
      setChapterNotes(notes);
      setBookmarks(chapterBookmarks);
      setHighlights(chapterHighlights);
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
    if (!speakingVerse || typeof document === 'undefined' || document.hidden) return;
    const targetElement = contentRef.current?.querySelector(`[data-verse="${speakingVerse}"]`);
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [speakingVerse]);

  useEffect(() => {
    const translationFeedback = location.state?.translationFeedback;
    if (!translationFeedback || translationFeedback.nextTranslationId !== translationId) {
      return;
    }

    const previousTranslation = getTranslationById(translationFeedback.previousTranslationId);
    setTranslationFeedbackActive(true);
    if (translationFeedbackTimerRef.current) {
      window.clearTimeout(translationFeedbackTimerRef.current);
    }
    translationFeedbackTimerRef.current = window.setTimeout(() => {
      setTranslationFeedbackActive(false);
      translationFeedbackTimerRef.current = null;
    }, TRANSLATION_FEEDBACK_DURATION_MS);

    dispatchAppToast({
      tone: 'info',
      title: `Switched to ${translation.abbreviation}`,
      message: previousTranslation?.abbreviation
        ? `${previousTranslation.abbreviation} to ${translation.abbreviation} in ${book.name} ${chapter}.`
        : `${translation.name} is now open in ${book.name} ${chapter}.`,
    });
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state: null }
    );
  }, [
    location,
    navigate,
    translationId,
    translation.abbreviation,
    translation.name,
    book.name,
    chapter,
  ]);

  useEffect(() => {
    const targetVerse = getVerseTargetFromLocation(location);
    if (!targetVerse || loading || error || !offlineState.ready || !verses.length) {
      if (!targetVerse) {
        setHighlightedVerse(null);
      }
      return;
    }

    const targetElement = contentRef.current?.querySelector(`[data-verse="${targetVerse}"]`);
    if (!targetElement) {
      setHighlightedVerse(null);
      return;
    }

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedVerse(targetVerse);

    const timeoutId = window.setTimeout(() => {
      setHighlightedVerse((current) => (current === targetVerse ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.hash, location.search, verses, loading, error, offlineState.ready]);

  const goTo = useCallback(function goTo(newBook, newChapter, newTranslation = translationId, options = {}) {
    const destination =
      options.verse == null
        ? {
            pathname: `/read/${newTranslation}/${newBook}/${newChapter}`,
          }
        : buildVerseLocation({
            translationId: newTranslation,
            bookId: newBook,
            chapter: newChapter,
            verse: options.verse,
          });

    navigate(destination, {
      replace: options.replace ?? true,
      state: options.state,
    });
  }, [navigate, translationId]);

  function handleTranslationNavigation(event) {
    const nextTranslationId = event.target.value;
    if (!nextTranslationId || nextTranslationId === translationId) {
      return;
    }

    saveSettings({
      ...settings,
      defaultTranslation: nextTranslationId,
    });

    goTo(bookId, chapter, nextTranslationId, {
      verse: getVerseTargetFromLocation(location),
      state: {
        translationFeedback: {
          previousTranslationId: translationId,
          nextTranslationId,
          timestamp: Date.now(),
        },
      },
    });
  }

  const navigateWithTransition = useCallback(function navigateWithTransition(direction, navigateFn) {
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
  }, []);

  const prevChapter = useCallback(function prevChapter() {
    const target = getPreviousBibleChapter(bookId, chapter);
    if (target) {
      navigateWithTransition('prev', () => goTo(target.bookId, target.chapter));
    }
  }, [bookId, chapter, navigateWithTransition, goTo]);

  const nextChapter = useCallback(function nextChapter() {
    const target = getNextBibleChapter(bookId, chapter);
    if (target) {
      navigateWithTransition('next', () => goTo(target.bookId, target.chapter));
    }
  }, [bookId, chapter, navigateWithTransition, goTo]);

  const handleContentTouchStart = useCallback(function handleContentTouchStart(event) {
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
  }, [showBookSelector, showChapterSelector, showNoteModal, showReaderActions, loading, error, offlineState.ready]);

  const handleContentTouchEnd = useCallback(function handleContentTouchEnd(event) {
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
  }, [nextChapter, prevChapter]);

  function versesWithNotes() {
    const noteMap = new Set();
    chapterNotes.forEach((n) => noteMap.add(n.verse));
    return noteMap;
  }

  function openNoteForVerse(verse) {
    setShowReaderActions(false);
    setNoteModalContext('verse');
    const existing = chapterNotes.find((n) => n.verse === verse);
    if (existing) {
      setNoteTitle(existing.title || '');
      setNoteText(existing.text);
      setNoteTags((existing.tags || []).join(', '));
      setEditingNoteId(existing.id);
    } else {
      setNoteTitle('');
      setNoteText('');
      setNoteTags('');
      setEditingNoteId(null);
    }
    setSelectedVerse(verse);
    setShowNoteModal(true);
  }

  function openQuickNoteModal() {
    setNoteModalContext('quick');
    setSelectedVerse(null);
    setNoteTitle('');
    setNoteText('');
    setNoteTags('');
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

  const handleStartTextToSpeech = useCallback(function handleStartTextToSpeech() {
    setShowReaderActions(false);

    if (!textToSpeechSupported) {
      dispatchAppToast({
        tone: 'danger',
        title: 'Read aloud unavailable',
        message: 'Text to speech is not available in this browser.',
      });
      return;
    }

    if (!offlineState.ready || loading || error || !verses.length) {
      dispatchAppToast({
        tone: 'info',
        title: 'Chapter not ready',
        message: 'Load a chapter before starting read aloud.',
      });
      return;
    }

    readAloud.start(
      {
        translationId,
        bookId,
        chapter,
      },
      {
        verses,
        continuous: true,
      }
    );
  }, [
    textToSpeechSupported,
    offlineState.ready,
    loading,
    error,
    verses,
    translationId,
    chapter,
    bookId,
    readAloud,
  ]);

  async function handleSaveNote() {
    if (!noteText.trim() && !noteTitle.trim()) {
      dispatchAppToast({
        tone: 'info',
        title: 'Note is empty',
        message: 'Add a title or note text before saving a note.',
      });
      return;
    }
    const isVerseLinked = noteModalContext === 'verse' && selectedVerse != null;
    const note = {
      ...(editingNoteId ? { id: editingNoteId } : {}),
      title: noteTitle.trim(),
      text: noteText.trim(),
      tags: noteTags,
      ...(isVerseLinked
        ? {
            translationId,
            bookId,
            chapter,
            verse: selectedVerse,
            verseStart: selectedVerse,
            verseEnd: selectedVerse,
            verseKey: `${bookId}:${chapter}:${selectedVerse}`,
            bookChapter: `${bookId}:${chapter}`,
          }
        : {}),
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
      const noteToDelete = chapterNotes.find((n) => n.id === editingNoteId);
      await deleteNote(editingNoteId);
      const removedHighlights = noteToDelete
        ? await deleteHighlightsForTarget({
            sourceType: 'bible',
            translationId: noteToDelete.translationId || translationId,
            bookId: noteToDelete.bookId || bookId,
            chapter: noteToDelete.chapter || chapter,
            verseStart: noteToDelete.verseStart || noteToDelete.verse,
            verseEnd: noteToDelete.verseEnd || noteToDelete.verse,
          })
        : 0;
      setShowNoteModal(false);
      const notes = await getNotesForChapter(bookId, chapter);
      setChapterNotes(notes);
      await refreshVerseMarkers();
      dispatchAppToast({
        tone: 'info',
        title: 'Note deleted',
        message: removedHighlights
          ? 'The verse note and highlight were removed.'
          : 'The verse note was removed.',
      });
    }
  }

  const verseSegmentsCache = useMemo(() => {
    const cache = new Map();
    if (!settings.showWordsOfChristInRed) return cache;
    for (const v of verses) {
      cache.set(
        v.verse,
        getWordsOfChristSegments({
          translationId,
          bookId,
          chapter,
          verse: v.verse,
          text: v.text,
          allowVerseFallback: settings.useVerseRedLetterFallback,
        })
      );
    }
    return cache;
  }, [verses, translationId, bookId, chapter, settings.showWordsOfChristInRed, settings.useVerseRedLetterFallback]);

  const otherTranslations = useMemo(
    () => availableTranslations.filter((t) => t.id !== translationId),
    [availableTranslations, translationId]
  );

  const noteVerses = useMemo(() => versesWithNotes(), [chapterNotes]);
  const selectedVerseData = useMemo(
    () => verses.find((item) => item.verse === selectedVerse) || null,
    [verses, selectedVerse]
  );
  const canShareSelectedVerse = noteModalContext === 'verse' && Boolean(selectedVerseData?.text);
  const selectedBookmark = useMemo(
    () =>
      bookmarks.find(
        (bookmark) =>
          bookmark.translationId === translationId &&
          bookmark.bookId === bookId &&
          Number(bookmark.chapter) === Number(chapter) &&
          Number(bookmark.verseStart) === Number(selectedVerse)
      ) || null,
    [bookmarks, translationId, bookId, chapter, selectedVerse]
  );
  const selectedHighlight = useMemo(
    () =>
      highlights.find(
        (highlight) =>
          highlight.translationId === translationId &&
          highlight.bookId === bookId &&
          Number(highlight.chapter) === Number(chapter) &&
          Number(highlight.verseStart) === Number(selectedVerse)
      ) || null,
    [highlights, translationId, bookId, chapter, selectedVerse]
  );
  const canSaveNote = Boolean(noteTitle.trim() || noteText.trim());

  async function refreshVerseMarkers() {
    const [chapterBookmarks, chapterHighlights] = await Promise.all([
      getBookmarks({ sourceType: 'bible', bookId }),
      getHighlightsForChapter({
        sourceType: 'bible',
        translationId,
        bookId,
        chapter,
      }),
    ]);
    setBookmarks(chapterBookmarks);
    setHighlights(chapterHighlights);
  }

  async function handleToggleBookmark() {
    if (!selectedVerseData) return;
    setIsSavingVerseMarker(true);

    try {
      if (selectedBookmark) {
        await deleteBookmark(selectedBookmark.id);
        dispatchAppToast({
          tone: 'info',
          title: 'Bookmark removed',
          message: `${book.name} ${chapter}:${selectedVerseData.verse} is no longer bookmarked.`,
        });
      } else {
        await saveBookmark({
          sourceType: 'bible',
          translationId,
          bookId,
          chapter,
          verse: selectedVerseData.verse,
          label: `${book.name} ${chapter}:${selectedVerseData.verse}`,
        });
        dispatchAppToast({
          tone: 'success',
          title: 'Bookmark saved',
          message: `${book.name} ${chapter}:${selectedVerseData.verse} is bookmarked.`,
        });
      }
      await refreshVerseMarkers();
    } catch (markerError) {
      dispatchAppToast({
        tone: 'danger',
        title: 'Bookmark failed',
        message: markerError.message || 'The bookmark could not be saved.',
      });
    } finally {
      setIsSavingVerseMarker(false);
    }
  }

  async function handleToggleHighlight() {
    if (!selectedVerseData) return;
    setIsSavingVerseMarker(true);

    try {
      if (selectedHighlight) {
        await deleteHighlight(selectedHighlight.id);
        dispatchAppToast({
          tone: 'info',
          title: 'Highlight removed',
          message: `${book.name} ${chapter}:${selectedVerseData.verse} is no longer highlighted.`,
        });
      } else {
        await saveHighlight({
          sourceType: 'bible',
          translationId,
          bookId,
          chapter,
          verse: selectedVerseData.verse,
          color: 'gold',
          label: `${book.name} ${chapter}:${selectedVerseData.verse}`,
        });
        dispatchAppToast({
          tone: 'success',
          title: 'Highlight saved',
          message: `${book.name} ${chapter}:${selectedVerseData.verse} is highlighted.`,
        });
      }
      await refreshVerseMarkers();
    } catch (markerError) {
      dispatchAppToast({
        tone: 'danger',
        title: 'Highlight failed',
        message: markerError.message || 'The highlight could not be saved.',
      });
    } finally {
      setIsSavingVerseMarker(false);
    }
  }

  const bookmarkedVerses = useMemo(
    () =>
      new Set(
        bookmarks
          .filter(
            (bookmark) =>
              bookmark.translationId === translationId &&
              bookmark.bookId === bookId &&
              Number(bookmark.chapter) === Number(chapter)
          )
          .map((bookmark) => Number(bookmark.verseStart))
      ),
    [bookmarks, translationId, bookId, chapter]
  );
  const currentChapterBookmarks = useMemo(
    () =>
      bookmarks
        .filter(
          (bookmark) =>
            bookmark.translationId === translationId &&
            bookmark.bookId === bookId &&
            Number(bookmark.chapter) === Number(chapter)
        )
        .sort((left, right) => Number(left.verseStart) - Number(right.verseStart)),
    [bookmarks, translationId, bookId, chapter]
  );
  const highlightedVerses = useMemo(
    () => new Set(highlights.map((highlight) => Number(highlight.verseStart))),
    [highlights]
  );

  function jumpToBookmarkedVerse(verse) {
    const verseNumber = Number(verse);
    const targetElement = contentRef.current?.querySelector(`[data-verse="${verseNumber}"]`);
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedVerse(verseNumber);
    window.setTimeout(() => {
      setHighlightedVerse((current) => (current === verseNumber ? null : current));
    }, 1800);
  }

  async function handleShareVerse() {
    if (!selectedVerseData) {
      return;
    }

    try {
      const payload = createVerseSharePayload({
        origin: window.location.origin,
        translationId,
        bookId,
        chapter,
        verse: selectedVerseData.verse,
        verseText: selectedVerseData.text,
        bookName: book.name,
        translationLabel: translation.abbreviation,
      });
      const result = await shareVersePayload(payload);

      if (result.outcome === 'copied') {
        dispatchAppToast({
          tone: 'success',
          title: 'Verse copied',
          message: 'The verse text and link are ready to paste.',
        });
      }
    } catch (shareError) {
      dispatchAppToast({
        tone: 'danger',
        title: 'Unable to share verse',
        message: shareError.message || 'The verse could not be shared from this browser.',
      });
    }
  }

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
            <BookOpen size={16} aria-hidden="true" />
            <span>{book?.name || bookId}</span>
          </button>
          <button
            className="selector-btn"
            onClick={() => {
              setShowChapterSelector(true);
              setShowBookSelector(false);
            }}
          >
            <List size={16} aria-hidden="true" />
            <span>Ch. {chapter}</span>
          </button>
          <select
            className={`translation-select${translationFeedbackActive ? ' translation-select-confirm' : ''}`}
            value={translationId}
            aria-label="Bible translation"
            onChange={handleTranslationNavigation}
          >
            {/* Always show current translation */}
            {translation && (
              <option value={translationId}>{translation.abbreviation}</option>
            )}
            {otherTranslations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbreviation}
                </option>
            ))}
          </select>
        </div>
        {settings.showGlobalSearchBar && (
          <div className="read-inline-search">
            <GlobalSearchBar translationId={translationId} variant="inline" />
          </div>
        )}
        <a
          href={`https://biblehub.com/${book?.name?.toLowerCase().replace(/\s+/g, '_') || bookId}/${chapter}.htm`}
          {...externalNavigationProps}
          className="research-link"
          title="View commentaries on Bible Hub"
          aria-label="View commentaries on Bible Hub"
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
            <h3 className="section-label">Old Testament</h3>
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
            <h3 className="section-label" style={{ marginTop: '1rem' }}>New Testament</h3>
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
        className={`read-content${chapterTransition.animating ? ` is-turning-${chapterTransition.direction}` : ''}${
          translationFeedbackActive ? ' is-switching-translation' : ''
        }`}
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

        {offlineState.ready && offlineState.message && (
          <div className="read-inline-state" role="status" aria-live="polite">
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
          </div>
        )}


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
          <>
            {currentChapterBookmarks.length > 0 && (
              <section className="chapter-bookmarks" aria-label="Bookmarked verses in this chapter">
                <div className="chapter-bookmarks-header">
                  <Bookmark size={15} aria-hidden="true" />
                  <span>Bookmarked verses</span>
                </div>
                <div className="chapter-bookmarks-list">
                  {currentChapterBookmarks.map((bookmark) => (
                    <button
                      key={bookmark.id}
                      type="button"
                      className="chapter-bookmark-chip"
                      onClick={() => jumpToBookmarkedVerse(bookmark.verseStart)}
                    >
                      {book.name} {chapter}:{bookmark.verseStart}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div
              className={`verses ${settings.oneVersePerLine ? 'verses-stacked' : ''}`}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
              }}
            >
              {verses.map((v) => {
                const verseSegments = verseSegmentsCache.get(v.verse) ?? null;

                return (
                  <span
                    key={v.verse}
                    className={`verse ${noteVerses.has(v.verse) ? 'has-note' : ''} ${
                      highlightedVerse === v.verse ? 'verse-targeted' : ''
                    } ${speakingVerse === v.verse ? 'verse-speaking' : ''} ${
                      highlightedVerses.has(v.verse) ? 'verse-highlighted' : ''
                    } ${bookmarkedVerses.has(v.verse) ? 'verse-bookmarked' : ''}`}
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
          </>
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
            aria-label={
              noteModalContext === 'verse'
                ? `Note for ${book?.name} ${chapter}:${selectedVerse}`
                : 'New note'
            }
            ref={noteModalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              <StickyNote size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} aria-hidden="true" />
              {noteModalContext === 'verse'
                ? `${book?.name} ${chapter}:${selectedVerse}`
                : 'New note'}
            </h2>
            {noteModalContext === 'verse' && selectedVerseData && (
              <div className="read-note-verse-preview">
                <p className="read-note-verse-meta">{translation.abbreviation}</p>
                <blockquote>{selectedVerseData.text}</blockquote>
              </div>
            )}
            <label htmlFor="note-text" className="sr-only">Note text</label>
            <label htmlFor="note-title" className="sr-only">Note title</label>
            <input
              id="note-title"
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)"
              aria-label="Note title"
            />
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              autoFocus
              style={{ width: '100%' }}
            />
            <label htmlFor="note-tags" className="sr-only">Note tags</label>
            <input
              id="note-tags"
              type="text"
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="Tags, separated by commas"
              aria-label="Note tags"
            />
            <div className="modal-actions">
              {noteModalContext === 'verse' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleToggleBookmark}
                    disabled={isSavingVerseMarker}
                    aria-pressed={Boolean(selectedBookmark)}
                  >
                    <Bookmark size={14} aria-hidden="true" />
                    {selectedBookmark ? 'Remove bookmark' : 'Bookmark'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleToggleHighlight}
                    disabled={isSavingVerseMarker}
                    aria-pressed={Boolean(selectedHighlight)}
                  >
                    <Highlighter size={14} aria-hidden="true" />
                    {selectedHighlight ? 'Remove highlight' : 'Highlight'}
                  </button>
                </>
              )}
              {canShareSelectedVerse && (
                <button type="button" className="btn btn-outline btn-sm" onClick={handleShareVerse}>
                  <Share2 size={14} aria-hidden="true" />
                  Share verse
                </button>
              )}
              {editingNoteId && (
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteNote}>
                  Delete
                </button>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNoteModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveNote}
                disabled={!canSaveNote}
              >
                {editingNoteId ? 'Update note' : 'Save note'}
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
                onClick={isSpeakingChapter ? readAloud.stop : handleStartTextToSpeech}
              >
                {isSpeakingChapter ? <Square size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                <span>{isSpeakingChapter ? 'Stop reading' : 'Read aloud continuously'}</span>
              </button>
            )}
            <button className="fab-action" onClick={openQuickNoteModal}>
              <StickyNote size={16} aria-hidden="true" />
              <span>Add note</span>
            </button>
            <button className="fab-action" onClick={handleSearchBarToggle}>
              <Search size={16} aria-hidden="true" />
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
    </>
  );
}
