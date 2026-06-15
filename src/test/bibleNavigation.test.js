import { describe, expect, it } from 'vitest';
import {
  getNextBibleChapter,
  getPreviousBibleChapter,
} from '../utils/bibleNavigation';

describe('Bible chapter navigation', () => {
  it('moves between chapters in the same book', () => {
    expect(getNextBibleChapter('GEN', 1)).toEqual({ bookId: 'GEN', chapter: 2 });
    expect(getPreviousBibleChapter('GEN', 2)).toEqual({ bookId: 'GEN', chapter: 1 });
  });

  it('crosses book boundaries', () => {
    expect(getNextBibleChapter('GEN', 50)).toEqual({ bookId: 'EXO', chapter: 1 });
    expect(getPreviousBibleChapter('EXO', 1)).toEqual({ bookId: 'GEN', chapter: 50 });
  });

  it('stops at the beginning and end of the Bible', () => {
    expect(getPreviousBibleChapter('GEN', 1)).toBeNull();
    expect(getNextBibleChapter('REV', 22)).toBeNull();
  });
});
