import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Read from './pages/Read';
import Books from './pages/Books';
import BookText from './pages/BookText';
import Search from './pages/Search';
import Translations from './pages/Translations';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import { getTranslationById } from './utils/bibleData';
import { getAllDownloadedTranslations, getTranslationMeta } from './utils/db';
import { queueTranslationInstall, resolveInstallableTranslationId } from './utils/api';
import { DEFAULT_TRANSLATION_ID } from './utils/translationConfig';
import { useAppSettings } from './hooks/useAppSettings';
import { applyDisplayPreferences } from './utils/displayPreferences';

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
      </Route>
    </Routes>
  );
}
