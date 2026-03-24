import { useEffect } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { dispatchAppToast } from '../utils/appToasts';
import { showBrowserNotification } from '../utils/notifications';
import { getLastAppOpenedAt, getLastRead, saveLastAppOpenedAt } from '../utils/storage';
import { getBookById } from '../utils/bibleData';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function buildWeeklyReminder(lastRead) {
  if (lastRead?.bookId && lastRead?.chapter) {
    const bookName = getBookById(lastRead.bookId)?.name || lastRead.bookId;
    return {
      title: 'Time to return to your reading',
      message: `Pick up again in ${bookName} ${lastRead.chapter}.`,
    };
  }

  return {
    title: 'Time to read this week',
    message: 'Open Yeshua and continue your Scripture reading this week.',
  };
}

export default function WeeklyReadingReminderManager() {
  const settings = useAppSettings();

  useEffect(() => {
    let cancelled = false;

    async function maybeNotify() {
      const previousOpenedAt = getLastAppOpenedAt();
      const nowIso = new Date().toISOString();

      if (!settings.enableWeeklyReadingReminders) {
        saveLastAppOpenedAt(nowIso);
        return;
      }

      const previousOpenedTime = previousOpenedAt ? new Date(previousOpenedAt).getTime() : null;
      const nowTime = Date.now();
      const isDue =
        typeof previousOpenedTime === 'number' &&
        Number.isFinite(previousOpenedTime) &&
        nowTime - previousOpenedTime >= WEEK_MS;

      if (!isDue) {
        saveLastAppOpenedAt(nowIso);
        return;
      }

      const reminder = buildWeeklyReminder(getLastRead());
      const sentBrowserNotification = settings.enableBrowserNotifications
        ? await showBrowserNotification({
            title: reminder.title,
            body: reminder.message,
            tag: 'yeshua-weekly-reading-reminder',
          })
        : false;

      if (cancelled) return;

      if (!sentBrowserNotification) {
        dispatchAppToast({
          tone: 'info',
          title: reminder.title,
          message: reminder.message,
        });
      }

      saveLastAppOpenedAt(nowIso);
    }

    maybeNotify();

    return () => {
      cancelled = true;
    };
  }, [settings.enableBrowserNotifications, settings.enableWeeklyReadingReminders]);

  return null;
}
