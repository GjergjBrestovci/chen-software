import { describe, expect, it } from 'vitest';
import {
  arrowHeadAt,
  ARROW_HALF_WIDTH,
  ARROW_LENGTH,
  edgeDirection,
  edgeLength,
  floatingEdge,
  pointAlongEdge,
} from '../edges';
import { containsPoint } from '../shapes';
import type { ShapeBox } from '../types';
import { distance, length } from '../vectors';

const entity: ShapeBox = {
  kind: 'rect',
  center: { x: 0, y: 0 },
  size: { width: 100, height: 60 },
};
const relationship: ShapeBox = {
  kind: 'diamond',
  center: { x: 300, y: 0 },
  size: { width: 120, height: 70 },
};

describe('floatingEdge', () => {
  it('starts and ends on the two boundaries, not the centres', () => {
    const segment = floatingEdge(entity, relationship);
    expect(segment.start).toEqual({ x: 50, y: 0 });
    expect(segment.end).toEqual({ x: 240, y: 0 });
  });

  it('leaves a gap, so the line never enters either shape', () => {
    const segment = floatingEdge(entity, relationship);
    expect(distance(segment.start, segment.end)).toBeLessThan(
      distance(entity.center, relationship.center),
    );
  });

  it('is symmetric: swapping the shapes swaps the ends', () => {
    const forward = floatingEdge(entity, relationship);
    const backward = floatingEdge(relationship, entity);
    expect(backward.start).toEqual(forward.end);
    expect(backward.end).toEqual(forward.start);
  });

  it('works on a diagonal', () => {
    const below: ShapeBox = {
      kind: 'ellipse',
      center: { x: 200, y: 200 },
      size: { width: 80, height: 40 },
    };
    const segment = floatingEdge(entity, below);
    expect(containsPoint(entity, segment.start)).toBe(true);
    expect(containsPoint(below, segment.end)).toBe(true);
    expect(segment.start).not.toEqual(entity.center);
  });

  it('collapses to the shared centre when two shapes sit on top of each other', () => {
    const twin: ShapeBox = { ...entity };
    const segment = floatingEdge(entity, twin);
    expect(segment.start).toEqual(entity.center);
    expect(segment.end).toEqual(entity.center);
  });
});

describe('edge measurements', () => {
  const segment = floatingEdge(entity, relationship);

  it('measures the visible length', () => {
    expect(edgeLength(segment)).toBe(190);
  });

  it('gives a unit direction', () => {
    expect(edgeDirection(segment)).toEqual({ x: 1, y: 0 });
    expect(length(edgeDirection(segment))).toBeCloseTo(1, 12);
  });

  it('gives a zero direction for a collapsed edge instead of NaN', () => {
    expect(edgeDirection({ start: { x: 5, y: 5 }, end: { x: 5, y: 5 } })).toEqual({ x: 0, y: 0 });
  });

  it('walks along the edge from the start', () => {
    expect(pointAlongEdge(segment, 0)).toEqual(segment.start);
    expect(pointAlongEdge(segment, 20)).toEqual({ x: 70, y: 0 });
    expect(pointAlongEdge(segment, edgeLength(segment))).toEqual(segment.end);
  });
});

describe('arrowHeadAt', () => {
  const tip = { x: 100, y: 50 };
  const from = { x: 0, y: 50 };

  it('points at the tip with its base back along the line', () => {
    const arrow = arrowHeadAt(tip, from, 10, 4);
    expect(arrow.tip).toEqual(tip);
    // The base midpoint sits `length` back from the tip, towards the other shape.
    expect((arrow.left.x + arrow.right.x) / 2).toBeCloseTo(90, 12);
    expect((arrow.left.y + arrow.right.y) / 2).toBeCloseTo(50, 12);
    // The corners stand either side of the line.
    expect(Math.abs(arrow.left.y - 50)).toBeCloseTo(4, 12);
    expect(Math.abs(arrow.right.y - 50)).toBeCloseTo(4, 12);
  });

  it('is symmetric however the arrow comes in', () => {
    for (const angle of [0, Math.PI / 6, Math.PI / 2, Math.PI, -Math.PI / 3]) {
      const source = {
        x: tip.x - Math.cos(angle) * 40,
        y: tip.y - Math.sin(angle) * 40,
      };
      const arrow = arrowHeadAt(tip, source, 10, 4);
      expect(distance(arrow.tip, arrow.left)).toBeCloseTo(distance(arrow.tip, arrow.right), 9);
      expect(distance(arrow.tip, arrow.left)).toBeCloseTo(Math.hypot(10, 4), 9);
    }
  });

  it('keeps the default proportions when no size is given', () => {
    const arrow = arrowHeadAt(tip, from);
    expect(arrow.tip.x - (arrow.left.x + arrow.right.x) / 2).toBeCloseTo(ARROW_LENGTH, 12);
    expect(Math.abs(arrow.left.y - arrow.tip.y)).toBeCloseTo(ARROW_HALF_WIDTH, 12);
  });

  it('collapses to the tip instead of NaN when the arrow has no direction', () => {
    const arrow = arrowHeadAt(tip, { x: tip.x, y: tip.y });
    expect(arrow).toEqual({ tip, left: tip, right: tip });
  });
});
