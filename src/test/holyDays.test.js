import { describe, it, expect } from 'vitest';
import {
  isHebrewLeapYear,
  getHebrewDateParts,
  getHolyDayWindow,
  formatCivilDate,
  formatCivilDateRange,
  supportsHebrewCalendar,
} from '../utils/holyDays';

describe('isHebrewLeapYear', () => {
  // Known leap years in the 19-year cycle: years where (7y+1) % 19 < 7
  it('identifies known Hebrew leap years', () => {
    // Hebrew year 5784 (2023-24) is a leap year
    expect(isHebrewLeapYear(5784)).toBe(true);
    // Hebrew year 5785 (2024-25) is not
    expect(isHebrewLeapYear(5785)).toBe(false);
  });
});

describe('getHebrewDateParts', () => {
  it('returns an object with day, month, monthKey, hebrewYear, label', () => {
    const parts = getHebrewDateParts(new Date(2024, 3, 15)); // Apr 15 2024
    expect(parts).toHaveProperty('day');
    expect(parts).toHaveProperty('month');
    expect(parts).toHaveProperty('monthKey');
    expect(parts).toHaveProperty('hebrewYear');
    expect(parts).toHaveProperty('label');
    expect(typeof parts.day).toBe('number');
    expect(parts.day).toBeGreaterThan(0);
  });

  it('defaults to today when no argument given', () => {
    const parts = getHebrewDateParts();
    expect(parts.day).toBeGreaterThan(0);
    expect(parts.hebrewYear).toBeGreaterThan(5000);
  });
});

describe('formatCivilDate', () => {
  it('returns a non-empty string for a valid date', () => {
    const result = formatCivilDate(new Date(2024, 0, 1));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatCivilDateRange', () => {
  it('returns a single date string when start equals end', () => {
    const d = new Date(2024, 3, 15);
    const result = formatCivilDateRange(d, d);
    expect(result).not.toContain('to');
  });

  it('returns a range string when dates differ', () => {
    const start = new Date(2024, 3, 15);
    const end = new Date(2024, 3, 22);
    const result = formatCivilDateRange(start, end);
    expect(result).toContain('to');
  });
});

describe('getHolyDayWindow', () => {
  it('returns supported:false shape when Hebrew calendar unsupported', () => {
    // Regardless of environment support, test the shape for the enabled:false path
    const result = getHolyDayWindow(new Date(), { enabled: false });
    expect(result.enabled).toBe(false);
    expect(result.active).toEqual([]);
    expect(result.week).toEqual([]);
    expect(result.next).toBeNull();
    expect(result.banner).toBeNull();
  });

  it('returns full shape with supported Hebrew calendar', () => {
    if (!supportsHebrewCalendar()) return; // skip if env doesn't support it

    const result = getHolyDayWindow(new Date(2024, 3, 15)); // Passover season
    expect(result.supported).toBe(true);
    expect(result.enabled).toBe(true);
    expect(Array.isArray(result.active)).toBe(true);
    expect(Array.isArray(result.week)).toBe(true);
    expect(typeof result.hebrewDateLabel).toBe('string');
    expect(result.weekRangeLabel).toContain('to');
  });

  it('detects Passover as active around Nisan 15', () => {
    if (!supportsHebrewCalendar()) return;

    // April 23 2024 is 15 Nisan 5784 (Passover start)
    const passoverDate = new Date(2024, 3, 23);
    const result = getHolyDayWindow(passoverDate);
    const activeIds = result.active.map((o) => o.id);
    expect(activeIds).toContain('passover');
  });

  it('detects Easter as active on Easter Sunday', () => {
    if (!supportsHebrewCalendar()) return;

    // Easter 2024 is March 31
    const easter = new Date(2024, 2, 31);
    const result = getHolyDayWindow(easter);
    const activeIds = result.active.map((o) => o.id);
    expect(activeIds).toContain('easter');
  });

  it('detects Christmas on December 25', () => {
    if (!supportsHebrewCalendar()) return;

    const christmas = new Date(2024, 11, 25);
    const result = getHolyDayWindow(christmas);
    const activeIds = result.active.map((o) => o.id);
    expect(activeIds).toContain('christmas');
  });

  it('respects preference to hide a holy day', () => {
    if (!supportsHebrewCalendar()) return;

    const christmas = new Date(2024, 11, 25);
    const result = getHolyDayWindow(christmas, {
      preferences: { christmas: { enabled: false } },
    });
    const activeIds = result.active.map((o) => o.id);
    expect(activeIds).not.toContain('christmas');
  });
});
