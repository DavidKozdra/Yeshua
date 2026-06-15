import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import WeeklyReadingReminderManager from './components/WeeklyReadingReminderManager';
import { getTranslationById } from './utils/bibleData';
import { getAllDownloadedTranslations, getTranslationMeta } from './utils/db';
import { queueTranslationInstall, resolveInstallableTranslationId } from './utils/api';
import { DEFAULT_TRANSLATION_ID } from './utils/translationConfig';
import { useAppSettings } from './hooks/useAppSettings';
import { applyDisplayPreferences } from './utils/displayPreferences';
import { ReadAloudProvider } from './components/ReadAloudProvider';

const Home = lazy(() => import('./pages/Home'));
const Read = lazy(() => import('./pages/Read'));
const Books = lazy(() => import('./pages/Books'));
const BookText = lazy(() => import('./pages/BookText'));
const Search = lazy(() => import('./pages/Search'));
const Translations = lazy(() => import('./pages/Translations'));
const Notes = lazy(() => import('./pages/Notes'));
const Settings = lazy(() => import('./pages/Settings'));

let startupDownloadPromise = null;

function ensureOfflineLibrary() {
  if (startupDownloadPromise) return startupDownloadPromise;

  startupDownloadPromise = (async () => {
    const downloadedTranslations = await getAllDownloadedTranslations();
    if (downloadedTranslations.length > 0) return;

    const translationId = resolveInstallableTranslationId(DEFAULT_TRANSLATION_ID);
    if (!translationId) return;

    const meta = await getTranslationMeta(translationId);
    if (meta?.isComplete) return;

    const translation = getTranslationById(translationId);

    console.log(`[Yeshua] Installing ${translation?.abbreviation || translationId.toUpperCase()} for offline use...`);
    try {
      const result = await queueTranslationInstall(translationId, { reason: 'startup' });
      console.log(
        `[Yeshua] ${(translation?.abbreviation || translationId.toUpperCase())} install complete (${result.completedChapters}/${result.totalChapters} chapters)`
      );
    } catch (err) {
      console.warn(
        `[Yeshua] ${(translation?.abbreviation || translationId.toUpperCase())} auto-install failed:`,
        err.message
      );
    }
  })();

  return startupDownloadPromise;
}

export default function App() {
  const settings = useAppSettings();

  // Auto-install the preferred startup translation on first launch.
  useEffect(() => {
    ensureOfflineLibrary();
  }, []);

  useEffect(() => {
    applyDisplayPreferences(settings);
  }, [settings]);

  return (
    <ReadAloudProvider>
      <WeeklyReadingReminderManager />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/read" element={<Read />} />
            <Route path="/read/:translationId/:bookId/:chapter" element={<Read />} />
            <Route path="/books" element={<Books />} />
            <Route path="/books/:collectionId" element={<BookText />} />
            <Route path="/books/:collectionId/:workId/:chapter" element={<BookText />} />
            <Route path="/search" element={<Search />} />
            <Route path="/translations" element={<Translations />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ReadAloudProvider>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="page" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

function NotFound() {
  return (
    <div className="page" role="main">
      <h1 className="page-title">Page not found</h1>
      <p>This page doesn&rsquo;t exist. <a href="/">Go home</a></p>
    </div>
  );
}
