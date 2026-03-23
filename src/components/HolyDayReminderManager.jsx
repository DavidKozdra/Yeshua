import { useEffect } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useHolyDays } from '../hooks/useHolyDays';
import { dispatchAppToast } from '../utils/appToasts';
import { hasSeenHolyDayReminder, markHolyDayReminderSeen } from '../utils/storage';

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
    if (!holyDays.supported || !holyDays.enabled || !holyDays.reminder) {
      return;
    }

    if (hasSeenHolyDayReminder(holyDays.reminder.key)) {
      return;
    }

    dispatchAppToast(buildReminderToast(holyDays.reminder));
    markHolyDayReminderSeen(holyDays.reminder.key);
  }, [holyDays]);

  return null;
}
