import { ArrowRight, BookOpen, CalendarDays, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../hooks/useAppSettings';
import { useHolyDays } from '../hooks/useHolyDays';
import { getBookById } from '../utils/bibleData';
import '../styles/holyDays.css';

function formatReadingLabel(reading) {
  return `${getBookById(reading.bookId)?.name || reading.bookId} ${reading.chapter}`;
}

function HolyDayListItem({ occurrence, translationId, onRead }) {
  return (
    <article className="holy-day-list-item" role="listitem">
      <div className="holy-day-list-copy">
        <div className="holy-day-list-topline">
          <strong>{occurrence.name}</strong>
          <span className="holy-day-list-meta">
            {occurrence.isActive
              ? occurrence.durationDays > 1
                ? `Day ${occurrence.dayNumber} of ${occurrence.durationDays}`
                : 'Today'
              : occurrence.shortRangeLabel}
          </span>
        </div>
        <p>{occurrence.summary}</p>
      </div>

      {occurrence.primaryReading && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onRead(translationId, occurrence.primaryReading.bookId, occurrence.primaryReading.chapter)}
        >
          <BookOpen size={14} aria-hidden="true" />
          {formatReadingLabel(occurrence.primaryReading)}
        </button>
      )}
    </article>
  );
}

export default function HolyDayManager() {
  const navigate = useNavigate();
  const settings = useAppSettings();
  const holyDays = useHolyDays(settings);

  if (!holyDays.supported || !holyDays.enabled) {
    return null;
  }

  const featuredOccurrence = holyDays.active[0] || holyDays.week[0] || holyDays.next;
  if (!featuredOccurrence) {
    return null;
  }

  function handleRead(translationId, bookId, chapter) {
    navigate(`/read/${translationId}/${bookId}/${chapter}`);
  }

  return (
    <div className="card holy-day-manager">
      <header className="holy-day-manager-header">
        <div>
          <div className="holy-day-manager-topline">
            <span className="chip">
              <Sparkles size={14} aria-hidden="true" />
              Holy Day Watch
            </span>
            <span className="chip">
              <CalendarDays size={14} aria-hidden="true" />
              {holyDays.hebrewDateLabel}
            </span>
          </div>
          <h2 className="holy-day-manager-title">{featuredOccurrence.name}</h2>
          <p className="holy-day-manager-subtitle">
            {featuredOccurrence.isActive
              ? `${featuredOccurrence.rangeLabel} · ${featuredOccurrence.practice}`
              : holyDays.week.length
                ? `Coming up ${featuredOccurrence.rangeLabel}`
                : `Next on the calendar: ${featuredOccurrence.rangeLabel}`}
          </p>
        </div>

        {featuredOccurrence.primaryReading && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              handleRead(
                settings.defaultTranslation,
                featuredOccurrence.primaryReading.bookId,
                featuredOccurrence.primaryReading.chapter
              )
            }
          >
            <BookOpen size={14} aria-hidden="true" />
            {featuredOccurrence.primaryReading.label}
          </button>
        )}
      </header>

      {holyDays.week.length > 0 ? (
        <div className="holy-day-week-list" role="list" aria-label="Holy days this week">
          {holyDays.week.map((occurrence) => (
            <HolyDayListItem
              key={occurrence.reminderId}
              occurrence={occurrence}
              translationId={settings.defaultTranslation}
              onRead={handleRead}
            />
          ))}
        </div>
      ) : (
        <div className="holy-day-empty-state">
          <p>No visible holy days fall between {holyDays.weekRangeLabel}.</p>
          {holyDays.next && (
            <p>
              The next scheduled observance is <strong>{holyDays.next.name}</strong> on {holyDays.next.rangeLabel}.
            </p>
          )}
        </div>
      )}

      {featuredOccurrence.secondaryReading && (
        <button
          type="button"
          className="holy-day-secondary-link"
          onClick={() =>
            handleRead(
              settings.defaultTranslation,
              featuredOccurrence.secondaryReading.bookId,
              featuredOccurrence.secondaryReading.chapter
            )
          }
        >
          Continue with {formatReadingLabel(featuredOccurrence.secondaryReading)}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}

      <p className="holy-day-disclaimer">
        Uses the local Hebrew calendar offline. Hidden observances stay out of banners and reminders.
      </p>
    </div>
  );
}
