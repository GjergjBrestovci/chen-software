import { describe, expect, it } from 'vitest';
import { MAX_IDENTIFIER_LENGTH, NameSet } from '../naming';

describe('NameSet', () => {
  it('hands out a free name unchanged', () => {
    expect(new NameSet().claim('book')).toBe('book');
  });

  it('numbers a taken name, ignoring case', () => {
    const names = new NameSet();
    expect(names.claim('Book')).toBe('Book');
    expect(names.claim('BOOK')).toBe('BOOK_2');
    expect(names.claim('book')).toBe('book_3');
    expect(names.has('book_2')).toBe(true);
    expect(names.has('page')).toBe(false);
  });

  it('keeps every name within MySQL’s 64 characters, suffix included', () => {
    const names = new NameSet();
    const long = 'x'.repeat(80);
    const first = names.claim(long);
    const second = names.claim(long);
    expect(first).toHaveLength(MAX_IDENTIFIER_LENGTH);
    expect(second).toHaveLength(MAX_IDENTIFIER_LENGTH);
    expect(second.endsWith('_2')).toBe(true);
  });
});
