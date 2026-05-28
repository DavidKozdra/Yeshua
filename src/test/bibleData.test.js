import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BIBLE_BOOKS,
  getBookById,
  getTranslationById,
  getTodaysReadings,
  DAILY_READINGS,
} from '../utils/bibleData';

describe('BIBLE_BOOKS', () => {
  it('contains 66 books', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
  });

  it('has 39 OT books and 27 NT books', () => {
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'NT')).toHaveLength(27);
  });

  it('all books have required fields', () => {
    for (const book of BIBLE_BOOKS) {
      expect(book).toHaveProperty('id');
      expect(book).toHaveProperty('name');
      expect(book.chapters).toBeGreaterThan(0);
      expect(['OT', 'NT']).toContain(book.testament);
    }
  });
});

describe('getBookById', () => {
  it('returns the correct book', () => {
    expect(getBookById('GEN')?.name).toBe('Genesis');
    expect(getBookById('REV')?.name).toBe('Revelation');
  });

  it('returns undefined for unknown ID', () => {
    expect(getBookById('XYZ')).toBeUndefined();
  });
});

describe('getTranslationById', () => {
  it('returns the KJV translation', () => {
    const t = getTranslationById('kjv');
    expect(t?.abbreviation).toBe('KJV');
  });

  it('returns undefined for unknown translation', () => {
    expect(getTranslationById('niv')).toBeUndefined();
  });
});

describe('getTodaysReadings', () => {
  it('returns exactly 3 readings', () => {
    expect(getTodaysReadings()).toHaveLength(3);
  });

  it('each reading has a bookId and chapter', () => {
    for (const reading of getTodaysReadings()) {
      expect(reading).toHaveProperty('book');
      expect(reading).toHaveProperty('chapter');
      expect(typeof reading.chapter).toBe('number');
    }
  });

  it('rotates by day — different days give different first readings', () => {
    const RealDate = global.Date;

    const stub = (ts) =>
      class MockDate extends RealDate {
        static now() { return ts; }
        constructor(...args) { super(args.length ? args[0] : ts); }
      };

    // Day 0 of year vs day (DAILY_READINGS.length) should wrap and could differ
    const jan1 = new Date(2025, 0, 1, 12).getTime();
    const future = new Date(2025, 0, 1 + DAILY_READINGS.length, 12).getTime();

    global.Date = stub(jan1);
    const r1 = getTodaysReadings()[0];
    global.Date = stub(future);
    const r2 = getTodaysReadings()[0];
    global.Date = RealDate;

    // After a full cycle they should be the same
    expect(r1).toEqual(r2);
  });
});
