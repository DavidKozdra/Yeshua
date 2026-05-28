import { describe, it, expect } from 'vitest';
import { parseReferenceInput } from '../utils/reference';

describe('parseReferenceInput', () => {
  it('returns null for non-string input', () => {
    expect(parseReferenceInput(null)).toBeNull();
    expect(parseReferenceInput(42)).toBeNull();
    expect(parseReferenceInput(undefined)).toBeNull();
  });

  it('returns null for unrecognized book names', () => {
    expect(parseReferenceInput('FakeBook 1')).toBeNull();
    expect(parseReferenceInput('')).toBeNull();
  });

  it('parses a book name with chapter and verse', () => {
    const result = parseReferenceInput('John 3:16');
    expect(result).toEqual({ bookId: 'JHN', chapter: 3, verse: 16, hasExplicitVerse: true });
  });

  it('parses a book name with chapter only', () => {
    const result = parseReferenceInput('Genesis 1');
    expect(result).toEqual({ bookId: 'GEN', chapter: 1, verse: 1, hasExplicitVerse: false });
  });

  it('defaults to chapter 1 verse 1 when no chapter given', () => {
    const result = parseReferenceInput('Psalms');
    expect(result).toEqual({ bookId: 'PSA', chapter: 1, verse: 1, hasExplicitVerse: false });
  });

  it('resolves book aliases (genisis typo)', () => {
    const result = parseReferenceInput('Genisis 1');
    expect(result?.bookId).toBe('GEN');
  });

  it('resolves book alias psalm → PSA', () => {
    const result = parseReferenceInput('Psalm 23');
    expect(result?.bookId).toBe('PSA');
  });

  it('resolves book by ID (case-insensitive)', () => {
    const result = parseReferenceInput('rev 22');
    expect(result?.bookId).toBe('REV');
    expect(result?.chapter).toBe(22);
  });

  it('returns null when chapter exceeds book total', () => {
    expect(parseReferenceInput('Ruth 99')).toBeNull();
    expect(parseReferenceInput('Obadiah 2')).toBeNull(); // only 1 chapter
  });

  it('handles numbered book IDs', () => {
    const result = parseReferenceInput('1 Corinthians 13:4');
    expect(result).toEqual({ bookId: '1CO', chapter: 13, verse: 4, hasExplicitVerse: true });
  });

  it('is case-insensitive for book names', () => {
    expect(parseReferenceInput('genesis 1')?.bookId).toBe('GEN');
    expect(parseReferenceInput('GENESIS 1')?.bookId).toBe('GEN');
  });
});
