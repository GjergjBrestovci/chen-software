import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE,
  LINE_HEIGHT_RATIO,
  measureTextWidth,
  textBaselineOffset,
  textBoxSize,
  textLineHeight,
  underlineMetrics,
} from '../textMetrics';

describe('measureTextWidth', () => {
  it('measures nothing for an empty string', () => {
    expect(measureTextWidth('', 14)).toBe(0);
  });

  it('uses the Helvetica advance width', () => {
    // 'M' is 833/1000 em.
    expect(measureTextWidth('M', 1000)).toBeCloseTo(833, 6);
    expect(measureTextWidth('i', 1000)).toBeCloseTo(222, 6);
    expect(measureTextWidth(' ', 1000)).toBeCloseTo(278, 6);
  });

  it('distinguishes narrow from wide characters', () => {
    expect(measureTextWidth('iii', 14)).toBeLessThan(measureTextWidth('mmm', 14));
  });

  it('gives every digit the same width, as Helvetica does', () => {
    const widths = new Set('0123456789'.split('').map((digit) => measureTextWidth(digit, 14)));
    expect(widths.size).toBe(1);
  });

  it('scales linearly with the font size', () => {
    expect(measureTextWidth('BOOK', 24)).toBeCloseTo(measureTextWidth('BOOK', 12) * 2, 10);
  });

  it('sums its characters', () => {
    expect(measureTextWidth('AB', 14)).toBeCloseTo(
      measureTextWidth('A', 14) + measureTextWidth('B', 14),
      10,
    );
  });

  it('measures German characters, for the planned translation', () => {
    expect(measureTextWidth('ä', 1000)).toBeCloseTo(556, 6);
    expect(measureTextWidth('Ü', 1000)).toBeCloseTo(722, 6);
  });

  it('falls back to a sensible width for characters it does not know', () => {
    expect(measureTextWidth('漢', 1000)).toBeCloseTo(556, 6);
  });

  it('defaults the font size', () => {
    expect(measureTextWidth('BOOK')).toBe(measureTextWidth('BOOK', DEFAULT_FONT_SIZE));
  });

  it('is deterministic, so the PDF matches the screen', () => {
    expect(measureTextWidth('publication_date', 12)).toBe(measureTextWidth('publication_date', 12));
  });
});

describe('line metrics', () => {
  it('derives the line height from the font size', () => {
    expect(textLineHeight(10)).toBeCloseTo(10 * LINE_HEIGHT_RATIO, 10);
    expect(textLineHeight()).toBe(textLineHeight(DEFAULT_FONT_SIZE));
  });

  it('bundles width and height', () => {
    expect(textBoxSize('BOOK', 14)).toEqual({
      width: measureTextWidth('BOOK', 14),
      height: textLineHeight(14),
    });
    expect(textBoxSize('BOOK')).toEqual(textBoxSize('BOOK', DEFAULT_FONT_SIZE));
  });

  it('puts the baseline below the centre by half the cap height', () => {
    expect(textBaselineOffset(1000)).toBeCloseTo(359, 6);
    expect(textBaselineOffset(14)).toBeGreaterThan(0);
    expect(textBaselineOffset()).toBe(textBaselineOffset(DEFAULT_FONT_SIZE));
  });
});

describe('underlineMetrics', () => {
  it('matches the width of the text it underlines', () => {
    expect(underlineMetrics('isbn', 12).width).toBeCloseTo(measureTextWidth('isbn', 12), 10);
  });

  it('sits below the baseline', () => {
    expect(underlineMetrics('isbn', 12).offset).toBeGreaterThan(0);
  });

  it('stays visible at small font sizes', () => {
    expect(underlineMetrics('isbn', 4).thickness).toBe(1);
    expect(underlineMetrics('isbn', 40).thickness).toBeCloseTo(2, 10);
  });

  it('defaults the font size', () => {
    expect(underlineMetrics('isbn')).toEqual(underlineMetrics('isbn', DEFAULT_FONT_SIZE));
  });
});
