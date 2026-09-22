import { boundaryPoint, exitPoint } from './shapes';
import type { Point, ShapeBox } from './types';
import { add, distance, normalize, perpendicular, scale, subtract } from './vectors';

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

/** Separation between the two lines of total participation (SPEC.md §6). */
export const DOUBLE_LINE_GAP = 4;

/**
 * Separation between the lines of several ends that join the same entity to
 * the same relationship, as the two ends of a self-relationship do.
 */
export const SPREAD_GAP = 36;

/**
 * A line between two shapes, shifted sideways by `offset` from the
 * centre-to-centre line and clipped to both outlines.
 *
 * A positive offset shifts to the left of the direction from `from` to `to`,
 * which is upwards for a line pointing right. With no offset this is exactly
 * `floatingEdge`. If the shift is larger than a shape, the line starts at the
 * shifted centre rather than on the outline; the offsets the app uses are well
 * inside every shape.
 */
export function offsetEdge(from: ShapeBox, to: ShapeBox, offset: number): EdgeSegment {
  const direction = normalize(subtract(to.center, from.center));
  const shift = scale(perpendicular(direction), offset);
  const startOrigin = add(from.center, shift);
  const endOrigin = add(to.center, shift);

  return {
    start: exitPoint(from, startOrigin, direction),
    end: exitPoint(to, endOrigin, scale(direction, -1)),
  };
}

/**
 * The two lines of total participation (SPEC.md §6): `gap` apart, either side
 * of the line that would otherwise be drawn at `offset`.
 */
export function parallelEdges(
  from: ShapeBox,
  to: ShapeBox,
  gap: number = DOUBLE_LINE_GAP,
  offset = 0,
): [EdgeSegment, EdgeSegment] {
  return [offsetEdge(from, to, offset - gap / 2), offsetEdge(from, to, offset + gap / 2)];
}

/**
 * Sideways offsets for `count` lines between the same two shapes: `gap` apart
 * and centred on the centre-to-centre line, so a single line is not shifted.
 *
 * A relationship with several ends on one entity, such as a self-relationship,
 * would otherwise draw them all on top of each other, labels included.
 */
export function spreadOffsets(count: number, gap: number = SPREAD_GAP): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => (index - (count - 1) / 2) * gap);
}
