import { useEffect } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useHolyDays } from '../hooks/useHolyDays';
import { dispatchAppToast } from '../utils/appToasts';
import { hasSeenHolyDayReminder, markHolyDayReminderSeen } from '../utils/storage';
import { showBrowserNotification } from '../utils/notifications';

function buildReminderToast(reminder) {
  const { occurrence, type } = reminder;

  if (type === 'active') {
    return {
      tone: 'warning',
      title: `${occurrence.shortName} is active`,
      message: `${occurrence.summary} ${occurrence.rangeLabel}.`,
    };
  }

  return {
    tone: 'info',
    title: `${occurrence.shortName} is near`,
    message: `${occurrence.name} begins ${occurrence.rangeLabel}.`,
  };
}

export default function HolyDayReminderManager() {
  const settings = useAppSettings();
  const holyDays = useHolyDays(settings);

  useEffect(() => {
    let cancelled = false;

    async function notify() {
      if (!holyDays.supported || !holyDays.enabled || !holyDays.reminder) {
        return;
      }

      if (hasSeenHolyDayReminder(holyDays.reminder.key)) {
        return;
      }

      const toast = buildReminderToast(holyDays.reminder);
      const sentBrowserNotification = settings.enableBrowserNotifications
        ? await showBrowserNotification({
            title: toast.title,
            body: toast.message,
            tag: holyDays.reminder.key,
          })
        : false;

      if (cancelled) return;

      if (!sentBrowserNotification) {
        dispatchAppToast(toast);
      }

      markHolyDayReminderSeen(holyDays.reminder.key);
    }

    notify();

    return () => {
      cancelled = true;
    };
  }, [holyDays, settings.enableBrowserNotifications]);

  return null;
}
