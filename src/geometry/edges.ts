import { boundaryPoint } from './shapes';
import type { Point, ShapeBox } from './types';
import { add, distance, normalize, scale, subtract } from './vectors';

export interface EdgeSegment {
  /** On the boundary of the first shape. */
  start: Point;
  /** On the boundary of the second shape. */
  end: Point;
}

/**
 * The visible part of a line between two shapes: the centre-to-centre line,
 * clipped to both outlines (SPEC.md §5). Used for relationship edges and for
 * the implicit attribute-to-owner lines alike.
 */
export function floatingEdge(from: ShapeBox, to: ShapeBox): EdgeSegment {
  return {
    start: boundaryPoint(from, to.center),
    end: boundaryPoint(to, from.center),
  };
}

export function edgeLength(segment: EdgeSegment): number {
  return distance(segment.start, segment.end);
}

/** Unit vector pointing from `start` to `end`, or zero for a zero-length edge. */
export function edgeDirection(segment: EdgeSegment): Point {
  return normalize(subtract(segment.end, segment.start));
}

/** A point `travelled` pixels along the edge from its start. */
export function pointAlongEdge(segment: EdgeSegment, travelled: number): Point {
  return add(segment.start, scale(edgeDirection(segment), travelled));
}
