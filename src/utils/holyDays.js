/**
 * Holy day calendar engine.
 *
 * Defines the app's biblical/liturgical holy days and computes their
 * occurrences relative to a reference date. Uses the Intl Hebrew calendar
 * (with computed Easter/Ash Wednesday for movable Christian feasts) to find
 * active, upcoming, and weekly holy days, build banner/reminder data, and
 * format civil and Hebrew dates for display. Each holy day carries reading
 * suggestions, priority, and reminder defaults consumed by the UI.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HEBREW_LOCALE = 'en-u-ca-hebrew';
const HEBREW_DATE_FORMATTER = createFormatter(HEBREW_LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const CIVIL_DATE_FORMATTER = createFormatter(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const CIVIL_SHORT_DATE_FORMATTER = createFormatter(undefined, {
  month: 'short',
  day: 'numeric',
});

const MONTH_ALIASES = {
  tishri: 'tishri',
  tishrei: 'tishri',
  heshvan: 'heshvan',
  cheshvan: 'heshvan',
  kislev: 'kislev',
  tevet: 'tevet',
  shevat: 'shevat',
  shebat: 'shevat',
  'adar i': 'adar i',
  'adar 1': 'adar i',
  'adar ii': 'adar ii',
  'adar 2': 'adar ii',
  adar: 'adar',
  nisan: 'nisan',
  iyyar: 'iyyar',
  iyar: 'iyyar',
  sivan: 'sivan',
  tammuz: 'tammuz',
  tamuz: 'tammuz',
  av: 'av',
  elul: 'elul',
};

function createFormatter(locale, options) {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

const HOLY_DAY_DEFINITIONS = [
  {
    id: 'lent',
    name: 'Lent',
    shortName: 'Lent',
    durationDays: 44,
    priority: 70,
    isHighHolyDay: false,
    summary: 'A season of repentance, prayer, fasting, and preparation for Easter.',
    practice: 'Slow down, repent, and order your reading around prayer, fasting, and the passion of Christ.',
    primaryReading: { bookId: 'MAT', chapter: 4, label: 'Read Matthew 4' },
    secondaryReading: { bookId: 'JOL', chapter: 2, label: 'Read Joel 2' },
    matchesStart({ candidateDate, civilYear }) {
      return isSameCivilDate(candidateDate, getAshWednesday(civilYear));
    },
  },
  {
    id: 'purim',
    name: 'Purim',
    shortName: 'Purim',
    durationDays: 1,
    priority: 40,
    isHighHolyDay: false,
    summary: 'Remember the courage and deliverance recorded in Esther.',
    practice: 'A day for rejoicing, testimony, and revisiting God\'s hidden rescue.',
    primaryReading: { bookId: 'EST', chapter: 4, label: 'Read Esther 4' },
    secondaryReading: { bookId: 'EST', chapter: 9, label: 'Read Esther 9' },
    matchesStart({ monthKey, day, hebrewYear }) {
      return day === 14 && monthKey === (isHebrewLeapYear(hebrewYear) ? 'adar ii' : 'adar');
    },
  },
  {
    id: 'passover',
    name: 'Passover and Unleavened Bread',
    shortName: 'Passover',
    durationDays: 7,
    priority: 100,
    isHighHolyDay: true,
    summary: 'Turn your attention to redemption, deliverance, and the Lamb.',
    practice: 'Remember the Exodus, remove leaven, and revisit Yeshua\'s final meal and sacrifice.',
    primaryReading: { bookId: 'EXO', chapter: 12, label: 'Read Exodus 12' },
    secondaryReading: { bookId: 'LUK', chapter: 22, label: 'Read Luke 22' },
    relatedReadings: [
      { bookId: 'MAT', chapter: 26, label: 'Read Matthew 26' },
      { bookId: 'MRK', chapter: 14, label: 'Read Mark 14' },
      { bookId: 'JHN', chapter: 13, label: 'Read John 13' },
      { bookId: '1CO', chapter: 5, label: 'Read 1 Corinthians 5' },
    ],
    matchesStart({ monthKey, day }) {
      return monthKey === 'nisan' && day === 15;
    },
  },
  {
    id: 'first-fruits',
    name: 'First Fruits',
    shortName: 'First Fruits',
    durationDays: 1,
    priority: 85,
    isHighHolyDay: false,
    summary: 'Celebrate first fruits and resurrection hope.',
    practice: 'Give thanks for God\'s provision and the promise of new life.',
    primaryReading: { bookId: 'LEV', chapter: 23, label: 'Read Leviticus 23' },
    secondaryReading: { bookId: '1CO', chapter: 15, label: 'Read 1 Corinthians 15' },
    relatedReadings: [{ bookId: 'MAT', chapter: 28, label: 'Read Matthew 28' }],
    matchesStart({ monthKey, day }) {
      return monthKey === 'nisan' && day === 16;
    },
  },
  {
    id: 'shavuot',
    name: 'Shavuot',
    shortName: 'Shavuot',
    durationDays: 1,
    priority: 96,
    isHighHolyDay: true,
    summary: 'Reflect on covenant, Torah, and the outpouring of the Spirit.',
    practice: 'Study Scripture, give thanks for harvest, and revisit Sinai and Acts 2.',
    primaryReading: { bookId: 'EXO', chapter: 19, label: 'Read Exodus 19' },
    secondaryReading: { bookId: 'ACT', chapter: 2, label: 'Read Acts 2' },
    matchesStart({ monthKey, day }) {
      return monthKey === 'sivan' && day === 6;
    },
  },
  {
    id: 'easter',
    name: 'Easter',
    shortName: 'Easter',
    durationDays: 1,
    priority: 120,
    isHighHolyDay: true,
    summary: 'Celebrate the resurrection of Jesus Christ and the victory over death.',
    practice: 'Center your reading on the empty tomb, resurrection hope, and new life in Christ.',
    primaryReading: { bookId: 'JHN', chapter: 20, label: 'Read John 20' },
    secondaryReading: { bookId: '1CO', chapter: 15, label: 'Read 1 Corinthians 15' },
    matchesStart({ candidateDate, civilYear }) {
      return isSameCivilDate(candidateDate, getEasterSunday(civilYear));
    },
  },
  {
    id: 'trumpets',
    name: 'Feast of Trumpets',
    shortName: 'Trumpets',
    durationDays: 1,
    priority: 98,
    isHighHolyDay: true,
    summary: 'A solemn call to wakefulness, repentance, and remembrance.',
    practice: 'Pause, examine your heart, and prepare for the fall holy days.',
    primaryReading: { bookId: 'LEV', chapter: 23, label: 'Read Leviticus 23' },
    secondaryReading: { bookId: 'NUM', chapter: 29, label: 'Read Numbers 29' },
    relatedReadings: [
      { bookId: '1TH', chapter: 4, label: 'Read 1 Thessalonians 4' },
      { bookId: '1CO', chapter: 15, label: 'Read 1 Corinthians 15' },
    ],
    matchesStart({ monthKey, day }) {
      return monthKey === 'tishri' && day === 1;
    },
  },
  {
    id: 'atonement',
    name: 'Day of Atonement',
    shortName: 'Atonement',
    durationDays: 1,
    priority: 110,
    isHighHolyDay: true,
    summary: 'Set aside a day for humility, repentance, and mercy.',
    practice: 'Fast or simplify where appropriate, confess sin, and meditate on cleansing and intercession.',
    primaryReading: { bookId: 'LEV', chapter: 16, label: 'Read Leviticus 16' },
    secondaryReading: { bookId: 'HEB', chapter: 9, label: 'Read Hebrews 9' },
    relatedReadings: [{ bookId: 'HEB', chapter: 10, label: 'Read Hebrews 10' }],
    matchesStart({ monthKey, day }) {
      return monthKey === 'tishri' && day === 10;
    },
  },
  {
    id: 'tabernacles',
    name: 'Feast of Tabernacles',
    shortName: 'Tabernacles',
    durationDays: 7,
    priority: 99,
    isHighHolyDay: true,
    summary: 'Rejoice in God\'s presence, provision, and promised dwelling.',
    practice: 'Celebrate with gratitude and revisit the wilderness story and John 7.',
    primaryReading: { bookId: 'LEV', chapter: 23, label: 'Read Leviticus 23' },
    secondaryReading: { bookId: 'JHN', chapter: 7, label: 'Read John 7' },
    relatedReadings: [{ bookId: 'REV', chapter: 21, label: 'Read Revelation 21' }],
    matchesStart({ monthKey, day }) {
      return monthKey === 'tishri' && day === 15;
    },
  },
  {
    id: 'eighth-day-assembly',
    name: 'Eighth Day Assembly',
    shortName: 'Assembly',
    durationDays: 1,
    priority: 92,
    isHighHolyDay: true,
    summary: 'A final sacred assembly after Tabernacles.',
    practice: 'Gather, reflect, and close the festival season with gratitude and rest.',
    primaryReading: { bookId: 'LEV', chapter: 23, label: 'Read Leviticus 23' },
    secondaryReading: { bookId: 'NUM', chapter: 29, label: 'Read Numbers 29' },
    matchesStart({ monthKey, day }) {
      return monthKey === 'tishri' && day === 22;
    },
  },
  {
    id: 'christmas',
    name: 'Christmas',
    shortName: 'Christmas',
    durationDays: 1,
    priority: 115,
    isHighHolyDay: true,
    summary: 'Celebrate the birth of Jesus Christ and the Word made flesh.',
    practice: 'Return to the Nativity accounts and worship Christ come near.',
    primaryReading: { bookId: 'LUK', chapter: 2, label: 'Read Luke 2' },
    secondaryReading: { bookId: 'JHN', chapter: 1, label: 'Read John 1' },
    matchesStart({ civilMonth, civilDay }) {
      return civilMonth === 12 && civilDay === 25;
    },
  },
  {
    id: 'hanukkah',
    name: 'Hanukkah',
    shortName: 'Hanukkah',
    durationDays: 8,
    priority: 35,
    isHighHolyDay: false,
    summary: 'Remember dedication, faithfulness, and light in dark days.',
    practice: 'Reflect on temple dedication and Yeshua\'s appearance at the Feast of Dedication.',
    primaryReading: { bookId: 'JHN', chapter: 10, label: 'Read John 10' },
    secondaryReading: { bookId: 'PSA', chapter: 27, label: 'Read Psalm 27' },
    matchesStart({ monthKey, day }) {
      return monthKey === 'kislev' && day === 25;
    },
  },
];

/**
 * Lightweight list of all holy days for settings/preference UIs.
 *
 * Each entry exposes id, name, shortName, and isHighHolyDay derived from the
 * internal holy day definitions.
 *
 * @type {Array<{id: string, name: string, shortName: string, isHighHolyDay: boolean}>}
 */
export const HOLY_DAY_OPTIONS = HOLY_DAY_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  shortName: definition.shortName,
  isHighHolyDay: definition.isHighHolyDay,
}));

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date, days) {
  const nextDate = normalizeDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return normalizeDate(nextDate);
}

function differenceInCalendarDays(laterDate, earlierDate) {
  return Math.round((normalizeDate(laterDate) - normalizeDate(earlierDate)) / DAY_MS);
}

function normalizeMonthName(monthName) {
  return MONTH_ALIASES[monthName.toLowerCase().replace(/\./g, '').trim()] || monthName.toLowerCase();
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameCivilDate(leftDate, rightDate) {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day, 12);
}

function getAshWednesday(year) {
  return addDays(getEasterSunday(year), -46);
}

function formatShortDate(date) {
  return CIVIL_SHORT_DATE_FORMATTER.format(normalizeDate(date));
}

function isHolidayVisible(definition, preferences = {}) {
  return preferences[definition.id]?.enabled !== false;
}

function isHolidayReminderEnabled(definition, preferences = {}) {
  const preference = preferences[definition.id];
  if (preference?.enabled === false) return false;
  if (typeof preference?.remindersEnabled === 'boolean') {
    return preference.remindersEnabled;
  }
  return definition.isHighHolyDay;
}

function buildOccurrence(definition, startDate, referenceDate) {
  const endDate = addDays(startDate, definition.durationDays - 1);
  const isActive =
    differenceInCalendarDays(referenceDate, startDate) >= 0 &&
    differenceInCalendarDays(endDate, referenceDate) >= 0;
  const daysUntilStart = differenceInCalendarDays(startDate, referenceDate);
  const daysRemaining = isActive ? differenceInCalendarDays(endDate, referenceDate) + 1 : 0;
  const dayNumber = isActive ? definition.durationDays - daysRemaining + 1 : null;

  return {
    ...definition,
    startDate,
    endDate,
    isActive,
    daysUntilStart,
    daysRemaining,
    dayNumber,
    rangeLabel: formatCivilDateRange(startDate, endDate),
    shortRangeLabel:
      definition.durationDays > 1
        ? `${formatShortDate(startDate)} to ${formatShortDate(endDate)}`
        : formatShortDate(startDate),
    reminderId: `${definition.id}:${formatIsoDate(startDate)}`,
  };
}

function sortOccurrences(left, right) {
  return (
    left.startDate - right.startDate ||
    Number(right.isActive) - Number(left.isActive) ||
    right.priority - left.priority
  );
}

function sortByPriority(left, right) {
  return right.priority - left.priority || left.startDate - right.startDate;
}

function findOccurrences(referenceDate, definitions, daysForward = 400) {
  const occurrences = [];
  const seenOccurrenceIds = new Set();
  const backwardScanDays = Math.max(
    30,
    ...definitions.map((definition) => definition.durationDays + 7)
  );

  for (let offset = -backwardScanDays; offset <= daysForward; offset += 1) {
    const candidateDate = addDays(referenceDate, offset);
    const hebrewDate = getHebrewDateParts(candidateDate);
    const civilYear = candidateDate.getFullYear();
    const civilMonth = candidateDate.getMonth() + 1;
    const civilDay = candidateDate.getDate();

    for (const definition of definitions) {
      if (
        !definition.matchesStart({
          ...hebrewDate,
          candidateDate,
          civilYear,
          civilMonth,
          civilDay,
        })
      ) {
        continue;
      }

      const occurrenceId = `${definition.id}:${formatIsoDate(candidateDate)}`;
      if (seenOccurrenceIds.has(occurrenceId)) continue;

      occurrences.push(buildOccurrence(definition, candidateDate, referenceDate));
      seenOccurrenceIds.add(occurrenceId);
    }
  }

  return occurrences.sort(sortOccurrences);
}

function buildReminder(activeOccurrences, reminderCandidates, referenceDate, reminderLeadDays) {
  const activeHighHolyDay = activeOccurrences[0];
  if (activeHighHolyDay) {
    return {
      key: `${activeHighHolyDay.reminderId}:${formatIsoDate(referenceDate)}`,
      type: 'active',
      occurrence: activeHighHolyDay,
    };
  }

  const upcomingReminder = reminderCandidates.find(
    (occurrence) => !occurrence.isActive && occurrence.daysUntilStart <= reminderLeadDays
  );

  if (!upcomingReminder) return null;

  return {
    key: `${upcomingReminder.reminderId}:${formatIsoDate(referenceDate)}`,
    type: 'upcoming',
    occurrence: upcomingReminder,
  };
}

/**
 * Check whether the runtime's Intl supports the Hebrew calendar.
 *
 * @returns {boolean} True if the Hebrew calendar is available.
 */
export function supportsHebrewCalendar() {
  try {
    return new Intl.DateTimeFormat(HEBREW_LOCALE).resolvedOptions().calendar === 'hebrew';
  } catch {
    return false;
  }
}

/**
 * Determine whether a given Hebrew year is a leap year.
 *
 * Uses the 19-year Metonic cycle rule; leap years contain Adar I and Adar II.
 *
 * @param {number} hebrewYear The Hebrew calendar year.
 * @returns {boolean} True if the year is a leap year.
 */
export function isHebrewLeapYear(hebrewYear) {
  return ((7 * hebrewYear) + 1) % 19 < 7;
}

/**
 * Extract Hebrew calendar date parts for a civil date.
 *
 * @param {Date} [date] Civil date to convert (defaults to now).
 * @returns {{day: number, month: string, monthKey: string, hebrewYear: number, label: string}}
 *   Hebrew day, localized month name, normalized month key, Hebrew year, and a
 *   display label.
 */
export function getHebrewDateParts(date = new Date()) {
  const dateParts = HEBREW_DATE_FORMATTER.formatToParts(normalizeDate(date));
  const day = Number.parseInt(dateParts.find((part) => part.type === 'day')?.value || '0', 10);
  const month = dateParts.find((part) => part.type === 'month')?.value || '';
  const year = Number.parseInt(dateParts.find((part) => part.type === 'year')?.value || '0', 10);

  return {
    day,
    month,
    monthKey: normalizeMonthName(month),
    hebrewYear: year,
    label: `${day} ${month} ${year}`,
  };
}

/**
 * Format a civil date as a long human-readable string (e.g. "June 18, 2026").
 *
 * @param {Date} date The date to format.
 * @returns {string} Formatted date string.
 */
export function formatCivilDate(date) {
  return CIVIL_DATE_FORMATTER.format(normalizeDate(date));
}

/**
 * Format a civil date range, collapsing to a single date for same-day ranges.
 *
 * @param {Date} startDate Range start.
 * @param {Date} endDate Range end.
 * @returns {string} A single formatted date, or "start to end" range string.
 */
export function formatCivilDateRange(startDate, endDate) {
  if (differenceInCalendarDays(endDate, startDate) <= 0) {
    return formatCivilDate(startDate);
  }

  return `${formatShortDate(startDate)} to ${formatCivilDate(endDate)}`;
}

/**
 * Build the holy day window around a reference date.
 *
 * Finds active and upcoming holy day occurrences (respecting per-holiday
 * visibility and reminder preferences) and assembles the data the UI needs:
 * active list, the coming week's occurrences, the next occurrence, a banner
 * occurrence, a reminder, and date labels. Returns a disabled/unsupported
 * shape when the Hebrew calendar is unavailable or options.enabled is false.
 *
 * @param {Date} [referenceDate] The date to evaluate against (defaults to now).
 * @param {Object} [options] Configuration.
 * @param {boolean} [options.enabled] When false, returns a disabled window.
 * @param {Object} [options.preferences] Per-holiday visibility/reminder prefs keyed by id.
 * @param {number} [options.bannerWindowDays=7] Days ahead considered for the weekly window.
 * @param {number} [options.reminderLeadDays=2] Lead days for upcoming reminders.
 * @param {number} [options.daysForward=400] How far ahead to scan for occurrences.
 * @returns {Object} Holy day window with supported, enabled, hebrewDateLabel,
 *   active, week, next, banner, reminder, and weekRangeLabel fields.
 */
export function getHolyDayWindow(referenceDate = new Date(), options = {}) {
  if (!supportsHebrewCalendar()) {
    return {
      supported: false,
      enabled: false,
      hebrewDateLabel: '',
      active: [],
      week: [],
      next: null,
      banner: null,
      reminder: null,
      weekRangeLabel: '',
    };
  }

  if (options.enabled === false) {
    return {
      supported: true,
      enabled: false,
      hebrewDateLabel: getHebrewDateParts(referenceDate).label,
      active: [],
      week: [],
      next: null,
      banner: null,
      reminder: null,
      weekRangeLabel: '',
    };
  }

  const normalizedReferenceDate = normalizeDate(referenceDate);
  const bannerWindowDays = options.bannerWindowDays ?? 7;
  const reminderLeadDays = Math.max(0, options.reminderLeadDays ?? 2);
  const visibleDefinitions = HOLY_DAY_DEFINITIONS.filter((definition) =>
    isHolidayVisible(definition, options.preferences)
  );
  const reminderEligibleDefinitions = visibleDefinitions.filter((definition) =>
    isHolidayReminderEnabled(definition, options.preferences)
  );
  const visibleOccurrences = findOccurrences(
    normalizedReferenceDate,
    visibleDefinitions,
    options.daysForward ?? 400
  );
  const reminderOccurrences = reminderEligibleDefinitions.length
    ? findOccurrences(normalizedReferenceDate, reminderEligibleDefinitions, options.daysForward ?? 400)
    : [];
  const weekEndDate = addDays(normalizedReferenceDate, bannerWindowDays - 1);
  const reminderEndDate = addDays(normalizedReferenceDate, reminderLeadDays);
  const activeOccurrences = visibleOccurrences
    .filter((occurrence) => occurrence.isActive)
    .sort(sortByPriority);
  const weekOccurrences = visibleOccurrences.filter(
    (occurrence) => occurrence.startDate <= weekEndDate && occurrence.endDate >= normalizedReferenceDate
  );
  const nextOccurrence =
    visibleOccurrences.find((occurrence) => occurrence.daysUntilStart > 0) || null;
  const bannerOccurrence =
    activeOccurrences[0] ||
    weekOccurrences.find((occurrence) => !occurrence.isActive) ||
    null;
  const activeReminderOccurrences = reminderOccurrences
    .filter((occurrence) => occurrence.isActive)
    .sort(sortByPriority);
  const reminderCandidates = reminderOccurrences.filter(
    (occurrence) => occurrence.startDate <= reminderEndDate && occurrence.endDate >= normalizedReferenceDate
  );

  return {
    supported: true,
    enabled: true,
    today: normalizedReferenceDate,
    hebrewDateLabel: getHebrewDateParts(normalizedReferenceDate).label,
    active: activeOccurrences,
    week: weekOccurrences,
    next: nextOccurrence,
    banner: bannerOccurrence,
    reminder: buildReminder(
      activeReminderOccurrences,
      reminderCandidates,
      normalizedReferenceDate,
      reminderLeadDays
    ),
    weekRangeLabel: `${formatCivilDate(normalizedReferenceDate)} to ${formatCivilDate(weekEndDate)}`,
  };
}
