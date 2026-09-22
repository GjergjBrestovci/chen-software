import { describe, expect, it } from 'vitest';
import { boundaryPoint, containsPoint } from '../shapes';
import type { Point, ShapeBox, ShapeKind } from '../types';
import { distance } from '../vectors';

const CENTER: Point = { x: 100, y: 200 };
const SIZE = { width: 80, height: 40 };
const KINDS: ShapeKind[] = ['rect', 'diamond', 'ellipse'];

function box(kind: ShapeKind, size = SIZE): ShapeBox {
  return { kind, center: CENTER, size };
}

/** How far a point is from the outline, in normalised units (0 = exactly on it). */
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

describe('boundaryPoint', () => {
  it.each(KINDS)('lands exactly on the outline of a %s, from every angle', (kind) => {
    const shape = box(kind);
    for (const angle of ANGLES) {
      const target = {
        x: shape.center.x + Math.cos(angle) * 500,
        y: shape.center.y + Math.sin(angle) * 500,
      };
      expect(outlineResidual(shape, boundaryPoint(shape, target))).toBeLessThan(1e-9);
    }
  });

  it.each(KINDS)('stays on the ray towards the target for a %s', (kind) => {
    const shape = box(kind);
    for (const angle of ANGLES) {
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const target = {
        x: shape.center.x + direction.x * 500,
        y: shape.center.y + direction.y * 500,
      };
      const point = boundaryPoint(shape, target);
      const travelled = distance(shape.center, point);
      expect(point.x).toBeCloseTo(shape.center.x + direction.x * travelled, 9);
      expect(point.y).toBeCloseTo(shape.center.y + direction.y * travelled, 9);
    }
  });

  it('meets a rectangle at the middle of each side', () => {
    const shape = box('rect');
    expect(boundaryPoint(shape, { x: 1000, y: CENTER.y })).toEqual({ x: 140, y: 200 });
    expect(boundaryPoint(shape, { x: -1000, y: CENTER.y })).toEqual({ x: 60, y: 200 });
    expect(boundaryPoint(shape, { x: CENTER.x, y: 1000 })).toEqual({ x: 100, y: 220 });
    expect(boundaryPoint(shape, { x: CENTER.x, y: -1000 })).toEqual({ x: 100, y: 180 });
  });

  it('meets a rectangle exactly at the corner on the corner diagonal', () => {
    const shape = box('rect');
    const point = boundaryPoint(shape, { x: CENTER.x + 80, y: CENTER.y + 40 });
    expect(point.x).toBeCloseTo(140, 9);
    expect(point.y).toBeCloseTo(220, 9);
  });

  it('meets a diamond at its vertices', () => {
    const shape = box('diamond');
    expect(boundaryPoint(shape, { x: 1000, y: CENTER.y }).x).toBeCloseTo(140, 9);
    expect(boundaryPoint(shape, { x: CENTER.x, y: -1000 }).y).toBeCloseTo(180, 9);
  });

  it('cuts the corner on a diamond, unlike a rectangle', () => {
    const target = { x: CENTER.x + 100, y: CENTER.y + 100 };
    const onDiamond = boundaryPoint(box('diamond'), target);
    const onRect = boundaryPoint(box('rect'), target);
    expect(distance(CENTER, onDiamond)).toBeLessThan(distance(CENTER, onRect));
  });

  it('meets an ellipse at the ends of its axes', () => {
    const shape = box('ellipse');
    expect(boundaryPoint(shape, { x: 1000, y: CENTER.y }).x).toBeCloseTo(140, 9);
    expect(boundaryPoint(shape, { x: CENTER.x, y: 1000 }).y).toBeCloseTo(220, 9);
  });

  it('orders the three outlines as diamond, ellipse, rectangle on the diagonal', () => {
    const target = { x: CENTER.x + 100, y: CENTER.y + 100 };
    const reach = (kind: ShapeKind): number => distance(CENTER, boundaryPoint(box(kind), target));
    expect(reach('diamond')).toBeLessThan(reach('ellipse'));
    expect(reach('ellipse')).toBeLessThan(reach('rect'));
  });

  it.each(KINDS)('returns the centre when the target is the centre of a %s', (kind) => {
    expect(boundaryPoint(box(kind), CENTER)).toEqual(CENTER);
  });

  it.each(KINDS)('returns the centre for a zero-sized %s instead of NaN', (kind) => {
    const shape = box(kind, { width: 0, height: 0 });
    expect(boundaryPoint(shape, { x: 500, y: 500 })).toEqual(CENTER);
  });

  it('does not alias the centre it returns', () => {
    const shape = box('rect');
    const point = boundaryPoint(shape, CENTER);
    point.x = -1;
    expect(shape.center.x).toBe(100);
  });
});

describe('containsPoint', () => {
  it.each(KINDS)('contains the centre of a %s', (kind) => {
    expect(containsPoint(box(kind), CENTER)).toBe(true);
  });

  it.each(KINDS)('excludes a far away point for a %s', (kind) => {
    expect(containsPoint(box(kind), { x: 10000, y: 10000 })).toBe(false);
  });

  it.each(KINDS)('accepts its own boundary point for a %s', (kind) => {
    const shape = box(kind);
    expect(containsPoint(shape, boundaryPoint(shape, { x: 1000, y: 700 }))).toBe(true);
  });

  it('separates the three outlines at a shared corner', () => {
    const corner = { x: CENTER.x + 40, y: CENTER.y + 20 };
    expect(containsPoint(box('rect'), corner)).toBe(true);
    expect(containsPoint(box('ellipse'), corner)).toBe(false);
    expect(containsPoint(box('diamond'), corner)).toBe(false);
  });

  it.each(KINDS)('contains nothing when a %s has no area', (kind) => {
    expect(containsPoint(box(kind, { width: 0, height: 0 }), CENTER)).toBe(false);
  });
});
