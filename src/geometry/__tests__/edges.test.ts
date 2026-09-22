import { describe, expect, it } from 'vitest';
import { edgeDirection, edgeLength, floatingEdge, pointAlongEdge } from '../edges';
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
