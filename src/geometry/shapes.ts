import type { Point, ShapeBox, ShapeKind } from './types';
import { add, EPSILON, isZero, scale, subtract } from './vectors';

/**
 * How far along a direction the outline sits, as a multiple of that direction,
 * for a shape whose half-extents are `halfWidth` and `halfHeight`:
 *
 * - rect: `|x| = halfWidth` or `|y| = halfHeight`, whichever the ray meets first
 * - diamond: `|x|/halfWidth + |y|/halfHeight = 1`
 * - ellipse: `(x/halfWidth)² + (y/halfHeight)² = 1`
 */
function boundaryScale(
  kind: ShapeKind,
  direction: Point,
  halfWidth: number,
  halfHeight: number,
): number {
  const dx = Math.abs(direction.x);
  const dy = Math.abs(direction.y);

  switch (kind) {
    case 'rect': {
      const toVerticalEdge = dx > EPSILON ? halfWidth / dx : Number.POSITIVE_INFINITY;
      const toHorizontalEdge = dy > EPSILON ? halfHeight / dy : Number.POSITIVE_INFINITY;
      return Math.min(toVerticalEdge, toHorizontalEdge);
    }
    case 'diamond':
      return 1 / (dx / halfWidth + dy / halfHeight);
    case 'ellipse':
      return 1 / Math.hypot(direction.x / halfWidth, direction.y / halfHeight);
  }
}

/**
 * Where the ray from `box.center` towards `target` crosses the outline
 * (SPEC.md §5: lines connect shape boundaries, not centres).
 *
 * Degenerate inputs — a target at the centre, or a shape with no area — return
 * the centre, so a caller never sees NaN.
 */
export function boundaryPoint(box: ShapeBox, target: Point): Point {
  const direction = subtract(target, box.center);
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;

  if (isZero(direction) || halfWidth <= EPSILON || halfHeight <= EPSILON) {
    return { ...box.center };
  }

  return add(
    box.center,
    scale(direction, boundaryScale(box.kind, direction, halfWidth, halfHeight)),
  );
}

/** True when `point` lies inside or on `box`. */
export function containsPoint(box: ShapeBox, point: Point): boolean {
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;
  if (halfWidth <= EPSILON || halfHeight <= EPSILON) {
    return false;
  }

  const dx = Math.abs(point.x - box.center.x) / halfWidth;
  const dy = Math.abs(point.y - box.center.y) / halfHeight;

  switch (box.kind) {
    case 'rect':
      return dx <= 1 + EPSILON && dy <= 1 + EPSILON;
    case 'diamond':
      return dx + dy <= 1 + EPSILON;
    case 'ellipse':
      return dx * dx + dy * dy <= 1 + EPSILON;
  }
}
