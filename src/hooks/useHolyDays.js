import { useEffect, useState } from 'react';
import { getHolyDayWindow } from '../utils/holyDays';

function getDelayUntilNextRefresh() {
  const now = new Date();
  const nextRefresh = new Date(now);
  nextRefresh.setDate(nextRefresh.getDate() + 1);
  nextRefresh.setHours(0, 5, 0, 0);
  return Math.max(60_000, nextRefresh - now);
}

function buildHolyDayOptions(settings = {}) {
  return {
    enabled: settings.enableHolyDayAwareness,
    preferences: settings.holyDayPreferences,
    reminderLeadDays: settings.holyDayReminderLeadDays,
  };
}

export function useHolyDays(settings) {
  const [holyDays, setHolyDays] = useState(() => getHolyDayWindow(new Date(), buildHolyDayOptions(settings)));

  useEffect(() => {
    let active = true;

    function scheduleNext() {
      if (!active) return;
      window.setTimeout(() => {
        if (!active) return;
        setHolyDays(getHolyDayWindow(new Date(), buildHolyDayOptions(settings)));
        scheduleNext();
      }, getDelayUntilNextRefresh());
    }

    setHolyDays(getHolyDayWindow(new Date(), buildHolyDayOptions(settings)));
    scheduleNext();

    return () => {
      active = false;
    };
  }, [settings]);

  return holyDays;
}
