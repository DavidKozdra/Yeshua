import { BookOpen, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../hooks/useAppSettings';
import { useHolyDays } from '../hooks/useHolyDays';
import '../styles/holyDays.css';

export default function HolyDayBanner() {
  const navigate = useNavigate();
  const settings = useAppSettings();
  const holyDays = useHolyDays(settings);

  if (!holyDays.supported || !holyDays.enabled || !holyDays.banner) {
    return null;
  }

  const occurrence = holyDays.banner;

  return (
    <section
      className={`holy-day-banner ${occurrence.isActive ? 'is-active' : 'is-upcoming'} ${
        occurrence.isHighHolyDay ? 'is-high-holy-day' : ''
      }`}
      aria-label="Current holy day alert"
    >
      <div className="holy-day-banner-topline">
        <span className="chip">
          <CalendarDays size={14} aria-hidden="true" />
          {holyDays.hebrewDateLabel}
        </span>
        <span className="chip">{occurrence.isActive ? 'Holy day now' : 'This week'}</span>
        {occurrence.isHighHolyDay && <span className="chip">High holy day</span>}
      </div>

      <div className="holy-day-banner-copy">
        <h2>{occurrence.isActive ? `${occurrence.name} is underway` : `${occurrence.name} is approaching`}</h2>
        <p>{occurrence.summary}</p>
        <p className="holy-day-banner-meta">{occurrence.rangeLabel}</p>
      </div>

      <div className="holy-day-banner-actions">
        {occurrence.primaryReading && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              navigate(
                `/read/${settings.defaultTranslation}/${occurrence.primaryReading.bookId}/${occurrence.primaryReading.chapter}`
              )
            }
          >
            <BookOpen size={14} aria-hidden="true" />
            {occurrence.primaryReading.label}
          </button>
        )}
        <span className="holy-day-banner-note">
          Civil-date awareness is approximate. Observances begin at sundown.
        </span>
      </div>
    </section>
  );
}
