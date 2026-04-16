import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, User, ExternalLink } from 'lucide-react';
import { getTodaysReadings, getBookById } from '../utils/bibleData';
import HolyDayBanner from '../components/HolyDayBanner';
import HolyDayManager from '../components/HolyDayManager';
import HolyDayReminderManager from '../components/HolyDayReminderManager';
import { useAppSettings } from '../hooks/useAppSettings';
import { getLastBooksRead, getLastRead, getProfile } from '../utils/storage';
import { getExternalNavigationProps } from '../utils/externalLinks';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const [readings] = useState(getTodaysReadings);
  const [lastRead, setLastRead] = useState(null);
  const [lastBooksRead, setLastBooksRead] = useState(null);
  const [profile, setProfile] = useState(getProfile);
  const settings = useAppSettings();
  const externalNavigationProps = getExternalNavigationProps();

  useEffect(() => {
    setLastRead(getLastRead());
    setLastBooksRead(getLastBooksRead());
    setProfile(getProfile());
  }, []);

  function goToReading(bookId, chapter, translationId = settings.defaultTranslation) {
    navigate(`/read/${translationId}/${bookId}/${chapter}`);
  }

  return (
    <div className="page home-page">
      <HolyDayReminderManager />

      {/* Profile greeting */}
      <header className="home-header">
        <div className="profile-section">
          <div className="profile-avatar">
            <User size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="greeting">
              {profile.name ? `Welcome back, ${profile.name}` : 'Welcome to Yeshua'}
            </h1>
          </div>
        </div>
      </header>

      <HolyDayBanner />

      {/* Continue Reading */}
      {lastRead && (
        <section className="home-section">
          <h2 className="section-label">Continue Reading</h2>
          <button
            type="button"
            className="card card-clickable continue-card"
            aria-label={`Continue reading ${getBookById(lastRead.bookId)?.name} Chapter ${lastRead.chapter}`}
            onClick={() =>
              goToReading(
                lastRead.bookId,
                lastRead.chapter,
                lastRead.translationId || settings.defaultTranslation
              )
            }
          >
            <div className="continue-info">
              <BookOpen size={20} aria-hidden="true" />
              <div>
                <strong>{getBookById(lastRead.bookId)?.name}</strong> Chapter {lastRead.chapter}
                <div className="continue-translation">{lastRead.translationId?.toUpperCase()}</div>
              </div>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      )}

      {settings.enableHolyDayAwareness && (
        <section className="home-section">
          <h2 className="section-label">Holy Days</h2>
          <HolyDayManager />
        </section>
      )}

      {/* Recommended Readings */}
      <section className="home-section">
        <h2 className="section-label">Recommended for Today</h2>
        <div className="readings-grid">
          {readings.map((r, i) => (
            <button
              key={i}
              type="button"
              className="card card-clickable reading-card"
              aria-label={`${r.title} — ${getBookById(r.book)?.name} ${r.chapter}`}
              onClick={() => goToReading(r.book, r.chapter)}
            >
              <h3>{r.title}</h3>
              <p className="reading-ref">
                {getBookById(r.book)?.name} {r.chapter}
              </p>
              <p className="reading-desc">{r.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-label">Library</h2>
        <button
          type="button"
          className="card card-clickable continue-card"
          aria-label="Open library"
          onClick={() =>
            navigate(
              lastBooksRead?.collectionId && lastBooksRead?.workId
                ? `/books/${lastBooksRead.collectionId}/${lastBooksRead.workId}/${lastBooksRead.chapter || 1}`
                : '/books'
            )
          }
        >
          <div className="continue-info">
            <BookOpen size={20} aria-hidden="true" />
            <div>
              <strong>Library</strong>
              <div className="continue-translation">
                {lastBooksRead?.collectionId
                  ? `Continue ${lastBooksRead.collectionId.replace(/-/g, ' ')}`
                  : "Bible, Qur'an, Apocrypha, Baha'i, and Zoroastrian resources"}
              </div>
            </div>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>

      {/* Quick Links / Research */}
      <section className="home-section">
        <h2 className="section-label">Study & Research</h2>
        <div className="links-grid">
          {[
            { name: 'Bible Project', url: 'https://bibleproject.com/', desc: 'Videos, podcasts, and guides for every book' },
            { name: 'Blue Letter Bible', url: 'https://www.blueletterbible.org/', desc: 'Concordance, lexicon, interlinear' },
            { name: 'Bible Hub', url: 'https://biblehub.com/', desc: 'Commentaries and cross-references' },
            { name: 'Got Questions', url: 'https://www.gotquestions.org/', desc: 'Biblical Q&A resource' },
            { name: 'Bible Gateway', url: 'https://www.biblegateway.com/', desc: 'Read in 200+ translations' },
          ].map((link) => (
            <a
              key={link.name}
              href={link.url}
              {...externalNavigationProps}
              className="card card-clickable link-card"
            >
              <div className="link-card-header">
                <strong>{link.name}</strong>
                <ExternalLink size={14} aria-hidden="true" />
              </div>
              <p>{link.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
