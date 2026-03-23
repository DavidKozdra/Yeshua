import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, User, ExternalLink } from 'lucide-react';
import { getTodaysReadings, getBookById } from '../utils/bibleData';
import HolyDayBanner from '../components/HolyDayBanner';
import HolyDayManager from '../components/HolyDayManager';
import HolyDayReminderManager from '../components/HolyDayReminderManager';
import { useAppSettings } from '../hooks/useAppSettings';
import { getLastRead, getProfile, saveProfile } from '../utils/storage';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const [readings] = useState(getTodaysReadings);
  const [lastRead, setLastRead] = useState(null);
  const [profile, setProfile] = useState(getProfile);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const settings = useAppSettings();

  useEffect(() => {
    setLastRead(getLastRead());
  }, []);

  function handleSaveName() {
    const updated = { ...profile, name: nameInput.trim() };
    setProfile(updated);
    saveProfile(updated);
    setEditingName(false);
  }

  function goToReading(bookId, chapter, translationId = settings.defaultTranslation) {
    navigate(`/read/${translationId}/${bookId}/${chapter}`);
  }

  return (
    <div className="page home-page">
      <HolyDayReminderManager />

      {/* Profile greeting */}
      <div className="home-header">
        <div className="profile-section">
          <div className="profile-avatar">
            <User size={24} />
          </div>
          <div>
            {editingName ? (
              <div className="name-edit">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  placeholder="Your name"
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveName}>
                  Save
                </button>
              </div>
            ) : (
              <>
                <h1 className="greeting">
                  {profile.name ? `Welcome back, ${profile.name}` : 'Welcome to Yeshua'}
                </h1>
                <button className="edit-name-btn" onClick={() => setEditingName(true)}>
                  {profile.name ? 'Edit name' : 'Set your name'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <HolyDayBanner />

      {/* Continue Reading */}
      {lastRead && (
        <section className="home-section">
          <p className="section-label">Continue Reading</p>
          <div
            className="card card-clickable continue-card"
            onClick={() =>
              goToReading(
                lastRead.bookId,
                lastRead.chapter,
                lastRead.translationId || settings.defaultTranslation
              )
            }
          >
            <div className="continue-info">
              <BookOpen size={20} />
              <div>
                <strong>{getBookById(lastRead.bookId)?.name}</strong> Chapter {lastRead.chapter}
                <div className="continue-translation">{lastRead.translationId?.toUpperCase()}</div>
              </div>
            </div>
            <ArrowRight size={18} />
          </div>
        </section>
      )}

      {settings.enableHolyDayAwareness && (
        <section className="home-section">
          <p className="section-label">Holy Days</p>
          <HolyDayManager />
        </section>
      )}

      {/* Recommended Readings */}
      <section className="home-section">
        <p className="section-label">Recommended for Today</p>
        <div className="readings-grid">
          {readings.map((r, i) => (
            <div
              key={i}
              className="card card-clickable reading-card"
              onClick={() => goToReading(r.book, r.chapter)}
            >
              <h3>{r.title}</h3>
              <p className="reading-ref">
                {getBookById(r.book)?.name} {r.chapter}
              </p>
              <p className="reading-desc">{r.description}</p>
            </div>
          ))}
        </div>
      </section>

      {settings.showBooksTab && (
        <section className="home-section">
          <p className="section-label">Library</p>
          <div className="card card-clickable continue-card" onClick={() => navigate('/books')}>
            <div className="continue-info">
              <BookOpen size={20} />
              <div>
                <strong>Books Library</strong>
                <div className="continue-translation">
                  Bible, Qur&apos;an, Apocrypha, and Baha&apos;i resources
                </div>
              </div>
            </div>
            <ArrowRight size={18} />
          </div>
        </section>
      )}

      {/* Quick Links / Research */}
      <section className="home-section">
        <p className="section-label">Study & Research</p>
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
              target="_blank"
              rel="noopener noreferrer"
              className="card card-clickable link-card"
            >
              <div className="link-card-header">
                <strong>{link.name}</strong>
                <ExternalLink size={14} />
              </div>
              <p>{link.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
