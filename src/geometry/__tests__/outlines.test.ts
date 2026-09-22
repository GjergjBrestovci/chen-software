import { describe, expect, it } from 'vitest';
import { boundaryPoint, containsPoint, DOUBLE_OUTLINE_INSET, exitPoint, insetBox } from '../shapes';
import { shapeSizeFor } from '../sizing';
import type { Point, ShapeBox, ShapeKind } from '../types';
import { distance, normalize, subtract } from '../vectors';

const KINDS: ShapeKind[] = ['rect', 'diamond', 'ellipse'];
const CENTER: Point = { x: 100, y: 200 };

function box(kind: ShapeKind, width = 120, height = 60): ShapeBox {
  return { kind, center: CENTER, size: { width, height } };
}

/** Distance from a point to a shape's outline, normalised (0 = exactly on it). */
function outlineResidual(shape: ShapeBox, point: Point): number {
  const dx = Math.abs(point.x - shape.center.x) / (shape.size.width / 2);
  const dy = Math.abs(point.y - shape.center.y) / (shape.size.height / 2);
  switch (shape.kind) {
    case 'rect':
      return Math.abs(Math.max(dx, dy) - 1);
    case 'diamond':
      return Math.abs(dx + dy - 1);
    case 'ellipse':
      return Math.abs(Math.hypot(dx, dy) - 1);
  }
}

const ANGLES = Array.from({ length: 72 }, (_, index) => (index * Math.PI) / 36);
const heading = (angle: number): Point => ({ x: Math.cos(angle), y: Math.sin(angle) });

describe('insetBox', () => {
  it('shrinks a rectangle by the inset on every side', () => {
    const inner = insetBox(box('rect'), 4);
    expect(inner.size).toEqual({ width: 112, height: 52 });
    expect(inner.center).toEqual(CENTER);
  });

  it('moves every side of a diamond inward by exactly the inset', () => {
    const outer = box('diamond');
    const inner = insetBox(outer, 4);
    const apothem = (shape: ShapeBox): number => {
      const a = shape.size.width / 2;
      const b = shape.size.height / 2;
      return (a * b) / Math.hypot(a, b);
    };
    expect(apothem(outer) - apothem(inner)).toBeCloseTo(4, 9);
  });

  it('keeps a diamond the same shape, so its sides stay parallel', () => {
    const inner = insetBox(box('diamond'), 4);
    expect(inner.size.width / inner.size.height).toBeCloseTo(120 / 60, 9);
  });

  it('reduces both radii of an ellipse by the inset', () => {
    const inner = insetBox(box('ellipse'), 4);
    expect(inner.size).toEqual({ width: 112, height: 52 });
  });

  it('keeps an ellipse the inset away on its axes and never touches between them', () => {
    // A real attribute, at the size the canvas actually draws.
    const outer: ShapeBox = {
      kind: 'ellipse',
      center: CENTER,
      size: shapeSizeFor('ellipse', 'email'),
    };
    const inner = insetBox(outer, DOUBLE_OUTLINE_INSET);

    const onOutline = (shape: ShapeBox, angle: number): Point => ({
      x: shape.center.x + (shape.size.width / 2) * Math.cos(angle),
      y: shape.center.y + (shape.size.height / 2) * Math.sin(angle),
    });
    const samples = Array.from({ length: 720 }, (_, index) => (index * Math.PI) / 360);
    const outerPoints = samples.map((angle) => onOutline(outer, angle));
    const gaps = samples.map((angle) => {
      const point = onOutline(inner, angle);
      return Math.min(...outerPoints.map((other) => distance(point, other)));
    });

    // Sampled, so allow a little for the spacing between samples.
    expect(Math.min(...gaps)).toBeGreaterThan(DOUBLE_OUTLINE_INSET * 0.6);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(DOUBLE_OUTLINE_INSET + 0.05);
  });

  it.each(KINDS)('keeps the inner %s entirely inside the outer one', (kind) => {
    const outer = box(kind);
    const inner = insetBox(outer);
    for (const angle of ANGLES) {
      const target = { x: CENTER.x + Math.cos(angle) * 500, y: CENTER.y + Math.sin(angle) * 500 };
      expect(containsPoint(outer, boundaryPoint(inner, target))).toBe(true);
    }
  });

  it.each(KINDS)('never gives a tiny %s a negative size', (kind) => {
    const inner = insetBox(box(kind, 6, 6), 10);
    expect(inner.size.width).toBeGreaterThanOrEqual(0);
    expect(inner.size.height).toBeGreaterThanOrEqual(0);
  });

  it('gives a zero-sized diamond a zero-sized inside rather than NaN', () => {
    expect(insetBox(box('diamond', 0, 0)).size).toEqual({ width: 0, height: 0 });
  });

  it('does not alias the centre it was given', () => {
    const outer = box('rect');
    const inner = insetBox(outer);
    inner.center.x = -1;
    expect(outer.center.x).toBe(CENTER.x);
  });

  it('uses the shared default inset', () => {
    expect(insetBox(box('rect')).size.width).toBe(120 - 2 * DOUBLE_OUTLINE_INSET);
  });
});

describe('exitPoint', () => {
  it.each(KINDS)('matches boundaryPoint for a ray from the centre of a %s', (kind) => {
    const shape = box(kind);
    for (const angle of ANGLES) {
      const direction = heading(angle);
      const target = { x: CENTER.x + direction.x * 500, y: CENTER.y + direction.y * 500 };
      const fromCentre = exitPoint(shape, CENTER, direction);
      const expected = boundaryPoint(shape, target);
      expect(fromCentre.x).toBeCloseTo(expected.x, 9);
      expect(fromCentre.y).toBeCloseTo(expected.y, 9);
    }
  });

  it.each(KINDS)('lands on the outline of a %s from an off-centre origin', (kind) => {
    const shape = box(kind);
    const origins: Point[] = [
      { x: CENTER.x + 10, y: CENTER.y - 5 },
      { x: CENTER.x - 20, y: CENTER.y + 8 },
      { x: CENTER.x, y: CENTER.y + 12 },
    ];
    for (const origin of origins) {
      for (const angle of ANGLES) {
        const point = exitPoint(shape, origin, heading(angle));
        expect(outlineResidual(shape, point)).toBeLessThan(1e-9);
      }
    }
  });

  it.each(KINDS)('stays on the ray it was given for a %s', (kind) => {
    const shape = box(kind);
    const origin = { x: CENTER.x + 7, y: CENTER.y - 4 };
    for (const angle of ANGLES) {
      const direction = heading(angle);
      const point = exitPoint(shape, origin, direction);
      const travelled = normalize(subtract(point, origin));
      expect(travelled.x).toBeCloseTo(direction.x, 9);
      expect(travelled.y).toBeCloseTo(direction.y, 9);
    }
  });

  it('does not care how long the direction vector is', () => {
    const shape = box('ellipse');
    const origin = { x: CENTER.x + 5, y: CENTER.y + 5 };
    const short = exitPoint(shape, origin, { x: 1, y: 1 });
    const long = exitPoint(shape, origin, { x: 50, y: 50 });
    expect(short.x).toBeCloseTo(long.x, 9);
    expect(short.y).toBeCloseTo(long.y, 9);
  });

  it.each(KINDS)('returns the origin for a zero direction on a %s', (kind) => {
    const origin = { x: CENTER.x + 3, y: CENTER.y };
    expect(exitPoint(box(kind), origin, { x: 0, y: 0 })).toEqual(origin);
  });

  it.each(KINDS)('returns the origin when it starts outside a %s', (kind) => {
    const outside = { x: CENTER.x + 1000, y: CENTER.y };
    expect(exitPoint(box(kind), outside, { x: 1, y: 0 })).toEqual(outside);
  });

  it.each(KINDS)('returns the origin for a %s with no area', (kind) => {
    expect(exitPoint(box(kind, 0, 0), CENTER, { x: 1, y: 0 })).toEqual(CENTER);
  });

  it('does not alias the origin it returns', () => {
    const origin = { x: CENTER.x, y: CENTER.y };
    const result = exitPoint(box('rect'), origin, { x: 0, y: 0 });
    result.x = -1;
    expect(origin.x).toBe(CENTER.x);
  });
});
