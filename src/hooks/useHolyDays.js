import { useEffect, useState } from 'react';
import { getHolyDayWindow } from '../utils/holyDays';

function getDelayUntilNextRefresh() {
  const now = new Date();
  const nextRefresh = new Date(now);
  nextRefresh.setHours(24, 5, 0, 0);
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
    let timeoutId;

    function refreshHolyDays() {
      setHolyDays(getHolyDayWindow(new Date(), buildHolyDayOptions(settings)));
      timeoutId = window.setTimeout(refreshHolyDays, getDelayUntilNextRefresh());
    }

    refreshHolyDays();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [settings]);

  return holyDays;
}
