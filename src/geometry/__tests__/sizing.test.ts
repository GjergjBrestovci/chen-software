import { describe, expect, it } from 'vitest';
import { containsPoint } from '../shapes';
import { fontSizeFor, SHAPE_METRICS, shapeSizeFor } from '../sizing';
import { textBoxSize } from '../textMetrics';
import type { ShapeBox, ShapeKind } from '../types';

const KINDS: ShapeKind[] = ['rect', 'diamond', 'ellipse'];

/** The four corners of the centred text box, which the outline must contain. */
function textCorners(
  kind: ShapeKind,
  text: string,
): { box: ShapeBox; corners: [number, number][] } {
  const size = shapeSizeFor(kind, text);
  const textBox = textBoxSize(text, fontSizeFor(kind));
  const halfWidth = textBox.width / 2;
  const halfHeight = textBox.height / 2;
  return {
    box: { kind, center: { x: 0, y: 0 }, size },
    corners: [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [-halfWidth, halfHeight],
      [halfWidth, halfHeight],
    ],
  };
}

describe('shapeSizeFor', () => {
  it.each(KINDS)('never goes below the minimum size for %s', (kind) => {
    // The minimum is a floor, not the size of an empty shape: a diamond has to
    // be tall enough for one line of text before the floor ever binds.
    for (const text of ['', 'a', 'BOOK', 'publication_date']) {
      const size = shapeSizeFor(kind, text);
      expect(size.width).toBeGreaterThanOrEqual(SHAPE_METRICS[kind].minWidth);
      expect(size.height).toBeGreaterThanOrEqual(SHAPE_METRICS[kind].minHeight);
    }
  });

  it.each(KINDS)('is smallest when a %s has no name yet', (kind) => {
    const empty = shapeSizeFor(kind, '');
    expect(empty.width).toBeLessThanOrEqual(shapeSizeFor(kind, 'BOOK').width);
    expect(empty.height).toBeLessThanOrEqual(shapeSizeFor(kind, 'BOOK').height);
  });

  it('applies the width floor to a short entity name', () => {
    expect(shapeSizeFor('rect', 'A').width).toBe(SHAPE_METRICS.rect.minWidth);
  });

  it.each(KINDS)('grows with the text for %s', (kind) => {
    const short = shapeSizeFor(kind, 'a');
    const long = shapeSizeFor(kind, 'publication_date_and_then_some_more');
    expect(long.width).toBeGreaterThan(short.width);
  });

  it.each(KINDS)('contains its own text for %s', (kind) => {
    const { box, corners } = textCorners(kind, 'publication_date');
    for (const [x, y] of corners) {
      expect(containsPoint(box, { x, y })).toBe(true);
    }
  });

  it.each(KINDS)('contains a very long name for %s', (kind) => {
    const { box, corners } = textCorners(kind, 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW');
    for (const [x, y] of corners) {
      expect(containsPoint(box, { x, y })).toBe(true);
    }
  });

  it('keeps a diamond narrower than the naive doubling would', () => {
    const text = 'published_by';
    const diamond = shapeSizeFor('diamond', text);
    const naiveWidth = 2 * (textBoxSize(text, fontSizeFor('diamond')).width + 2 * 10);
    expect(diamond.width).toBeLessThan(naiveWidth);
  });

  it('honours an explicit font size', () => {
    expect(shapeSizeFor('rect', 'BOOK', 40).width).toBeGreaterThan(
      shapeSizeFor('rect', 'BOOK', 14).width,
    );
  });

  it('is deterministic', () => {
    expect(shapeSizeFor('ellipse', 'isbn')).toEqual(shapeSizeFor('ellipse', 'isbn'));
  });
});

describe('fontSizeFor', () => {
  it('gives entities the largest text and attributes the smallest', () => {
    expect(fontSizeFor('rect')).toBeGreaterThan(fontSizeFor('diamond'));
    expect(fontSizeFor('diamond')).toBeGreaterThan(fontSizeFor('ellipse'));
  });
});
