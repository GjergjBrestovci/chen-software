import { describe, expect, it } from 'vitest';
import {
  DOUBLE_LINE_GAP,
  floatingEdge,
  offsetEdge,
  parallelEdges,
  spreadOffsets,
  SPREAD_GAP,
} from '../edges';
import { shapeSizeFor } from '../sizing';
import type { EdgeSegment } from '../edges';
import type { Point, ShapeBox, ShapeKind } from '../types';
import { normalize, subtract } from '../vectors';

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

/** Signed perpendicular distance from `point` to the line through `origin` along `direction`. */
function sideOf(origin: Point, direction: Point, point: Point): number {
  const unit = normalize(direction);
  const relative = subtract(point, origin);
  // The cross product, sign-flipped so left of the direction (screen up) is positive.
  return -(unit.x * relative.y - unit.y * relative.x);
}

function shape(kind: ShapeKind, x: number, y: number): ShapeBox {
  const name = kind === 'rect' ? 'EMPLOYEE' : kind === 'diamond' ? 'supervises' : 'email';
  return { kind, center: { x, y }, size: shapeSizeFor(kind, name) };
}

/** An entity with a relationship placed in each of eight directions around it. */
const PAIRS: [ShapeBox, ShapeBox][] = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4 + 0.3;
  return [
    shape('rect', 400, 400),
    shape('diamond', 400 + Math.cos(angle) * 300, 400 + Math.sin(angle) * 300),
  ];
});

describe('offsetEdge', () => {
  it('is exactly floatingEdge when there is no offset', () => {
    for (const [from, to] of PAIRS) {
      const plain = floatingEdge(from, to);
      const offset = offsetEdge(from, to, 0);
      expect(offset.start.x).toBeCloseTo(plain.start.x, 9);
      expect(offset.start.y).toBeCloseTo(plain.start.y, 9);
      expect(offset.end.x).toBeCloseTo(plain.end.x, 9);
      expect(offset.end.y).toBeCloseTo(plain.end.y, 9);
    }
  });

  it('starts and ends exactly on the two outlines, in every direction', () => {
    for (const [from, to] of PAIRS) {
      for (const amount of [-18, -2, 2, 18]) {
        const segment = offsetEdge(from, to, amount);
        expect(outlineResidual(from, segment.start)).toBeLessThan(1e-9);
        expect(outlineResidual(to, segment.end)).toBeLessThan(1e-9);
      }
    }
  });

  it('runs parallel to the centre line, exactly the offset away', () => {
    for (const [from, to] of PAIRS) {
      const direction = subtract(to.center, from.center);
      const segment = offsetEdge(from, to, 10);
      expect(sideOf(from.center, direction, segment.start)).toBeCloseTo(10, 9);
      expect(sideOf(from.center, direction, segment.end)).toBeCloseTo(10, 9);
    }
  });

  it('shifts upwards for a positive offset on a line pointing right', () => {
    const segment = offsetEdge(shape('rect', 0, 0), shape('diamond', 400, 0), 10);
    expect(segment.start.y).toBeCloseTo(-10, 9);
    expect(segment.end.y).toBeCloseTo(-10, 9);
  });

  it('mirrors a negative offset', () => {
    const from = shape('rect', 0, 0);
    const to = shape('diamond', 400, 0);
    expect(offsetEdge(from, to, -10).start.y).toBeCloseTo(-offsetEdge(from, to, 10).start.y, 9);
  });

  it('works between an attribute ellipse and its owner too', () => {
    const owner = shape('rect', 0, 0);
    const attribute = shape('ellipse', 150, -120);
    const segment = offsetEdge(attribute, owner, 3);
    expect(outlineResidual(attribute, segment.start)).toBeLessThan(1e-9);
    expect(outlineResidual(owner, segment.end)).toBeLessThan(1e-9);
  });

  it('collapses instead of producing NaN when the two shapes share a centre', () => {
    const segment = offsetEdge(shape('rect', 0, 0), shape('diamond', 0, 0), 10);
    for (const value of [segment.start.x, segment.start.y, segment.end.x, segment.end.y]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('starts at the shifted centre when the offset is wider than the shape', () => {
    const from = shape('rect', 0, 0);
    const segment = offsetEdge(from, shape('diamond', 400, 0), -1000);
    expect(segment.start).toEqual({ x: 0, y: 1000 });
  });
});

describe('parallelEdges', () => {
  function gapBetween(pair: [EdgeSegment, EdgeSegment], origin: Point, direction: Point): number {
    return sideOf(origin, direction, pair[1].start) - sideOf(origin, direction, pair[0].start);
  }

  it('draws two lines the default gap apart', () => {
    for (const [from, to] of PAIRS) {
      const direction = subtract(to.center, from.center);
      expect(gapBetween(parallelEdges(from, to), from.center, direction)).toBeCloseTo(
        DOUBLE_LINE_GAP,
        9,
      );
    }
  });

  it('straddles the line that would otherwise be drawn', () => {
    const [from, to] = PAIRS[0] ?? [];
    if (!from || !to) throw new Error('missing pair');
    const direction = subtract(to.center, from.center);
    const [first, second] = parallelEdges(from, to, 6);
    expect(sideOf(from.center, direction, first.start)).toBeCloseTo(-3, 9);
    expect(sideOf(from.center, direction, second.start)).toBeCloseTo(3, 9);
  });

  it('keeps both lines on the outlines', () => {
    for (const [from, to] of PAIRS) {
      for (const segment of parallelEdges(from, to)) {
        expect(outlineResidual(from, segment.start)).toBeLessThan(1e-9);
        expect(outlineResidual(to, segment.end)).toBeLessThan(1e-9);
      }
    }
  });

  it('centres on an offset line, so a spread end can be doubled as well', () => {
    const [from, to] = PAIRS[3] ?? [];
    if (!from || !to) throw new Error('missing pair');
    const direction = subtract(to.center, from.center);
    const [first, second] = parallelEdges(from, to, 4, 18);
    expect(sideOf(from.center, direction, first.start)).toBeCloseTo(16, 9);
    expect(sideOf(from.center, direction, second.start)).toBeCloseTo(20, 9);
  });
});

describe('spreadOffsets', () => {
  it('gives nothing for no lines', () => {
    expect(spreadOffsets(0)).toEqual([]);
    expect(spreadOffsets(-3)).toEqual([]);
  });

  it('leaves a single line where it was', () => {
    expect(spreadOffsets(1)).toEqual([0]);
  });

  it('splits two ends evenly either side of the centre line', () => {
    expect(spreadOffsets(2)).toEqual([-SPREAD_GAP / 2, SPREAD_GAP / 2]);
  });

  it('keeps three ends evenly spaced with the middle one centred', () => {
    expect(spreadOffsets(3, 10)).toEqual([-10, 0, 10]);
  });

  it('gives the two ends of a self-relationship separate lines', () => {
    const entity = shape('rect', 0, 0);
    const diamond = shape('diamond', 0, 250);
    const [a, b] = spreadOffsets(2).map((amount) => offsetEdge(entity, diamond, amount));
    expect(a?.start).not.toEqual(b?.start);
    expect(Math.abs((a?.start.x ?? 0) - (b?.start.x ?? 0))).toBeCloseTo(SPREAD_GAP, 9);
  });
});
