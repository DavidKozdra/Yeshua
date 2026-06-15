import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReadAloud } from './ReadAloudProvider';

export default function ReadAloudPlayer() {
  const navigate = useNavigate();
  const player = useReadAloud();

  if (!player.isActive && !player.error) return null;

  const reference = player.bookName && player.chapter
    ? `${player.bookName} ${player.chapter}`
    : 'Bible reading';
  const status = player.error
    ? player.error
    : player.isLoading
      ? `Loading ${reference}...`
      : player.isPaused
        ? `${reference} paused${player.verse ? ` at verse ${player.verse}` : ''}.`
        : `Reading ${reference}${player.verse ? `, verse ${player.verse}` : ''}.`;

  function openCurrentChapter() {
    if (!player.translationId || !player.bookId || !player.chapter) return;
    navigate(`/read/${player.translationId}/${player.bookId}/${player.chapter}`);
  }

  return (
    <section
      className={`read-aloud-player${player.error ? ' is-error' : ''}`}
      aria-label="Read aloud player"
      aria-live="polite"
    >
      <button
        type="button"
        className="read-aloud-player-copy"
        onClick={openCurrentChapter}
        disabled={!player.bookId}
        aria-label={`Open ${reference}`}
      >
        <Volume2 size={18} aria-hidden="true" />
        <span>
          <strong>{reference}</strong>
          <small>{status}</small>
        </span>
      </button>

      {!player.error && (
        <div className="read-aloud-player-controls">
          <button
            type="button"
            onClick={player.skipPrevious}
            disabled={!player.hasPrevious || player.isLoading}
            aria-label="Previous chapter"
          >
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="read-aloud-primary-control"
            onClick={player.togglePause}
            disabled={player.isLoading}
            aria-label={player.isPaused ? 'Resume text to speech' : 'Pause text to speech'}
          >
            {player.isPaused
              ? <Play size={19} aria-hidden="true" />
              : <Pause size={19} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={player.skipNext}
            disabled={!player.hasNext || player.isLoading}
            aria-label="Next chapter"
          >
            <SkipForward size={18} aria-hidden="true" />
          </button>
          <label className="read-aloud-player-volume">
            <span className="sr-only">Text to speech volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={player.volume}
              onChange={(event) => player.setVolume(event.target.value)}
              aria-label="Text to speech volume"
            />
          </label>
          <button type="button" onClick={player.stop} aria-label="Stop text to speech">
            <Square size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {player.error && (
        <button type="button" className="btn btn-outline btn-sm" onClick={player.stop}>
          Dismiss
        </button>
      )}
    </section>
  );
}
