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

/** Distance between the two outlines of a double shape (SPEC.md §6). */
export const DOUBLE_OUTLINE_INSET = 4;

/**
 * The inner outline of a double shape: a weak entity, an identifying
 * relationship or a multivalued attribute (SPEC.md §6).
 *
 * A rectangle shrinks by `inset` on every side. A diamond is scaled about its
 * centre, which keeps its sides parallel and moves each inward by exactly
 * `inset`. A true fixed-distance curve inside an ellipse is not an ellipse, so
 * the inner outline is an ellipse with both radii reduced by `inset`. That is
 * exact on the axes and a little closer between them: measured at the default
 * 4px, the narrowest gap is about 3.7px for a typical attribute and 2.9px for a
 * very long, flat one. The two outlines never touch.
 *
 * Lines still meet the outer outline, so boundary intersection stays a single
 * computation per shape.
 */
export function insetBox(box: ShapeBox, inset: number = DOUBLE_OUTLINE_INSET): ShapeBox {
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;

  if (box.kind === 'diamond') {
    // Distance from the centre to each side.
    const apothem = (halfWidth * halfHeight) / Math.hypot(halfWidth, halfHeight);
    const factor = apothem > EPSILON ? Math.max(0, (apothem - inset) / apothem) : 0;
    return {
      kind: box.kind,
      center: { ...box.center },
      size: { width: box.size.width * factor, height: box.size.height * factor },
    };
  }

  return {
    kind: box.kind,
    center: { ...box.center },
    size: {
      width: Math.max(0, box.size.width - 2 * inset),
      height: Math.max(0, box.size.height - 2 * inset),
    },
  };
}

/**
 * The sides of a rectangle or diamond as half-planes `n · p <= 1`, with `p`
 * relative to the centre.
 */
function halfPlanes(kind: 'rect' | 'diamond', halfWidth: number, halfHeight: number): Point[] {
  const x = 1 / halfWidth;
  const y = 1 / halfHeight;
  return kind === 'rect'
    ? [
        { x, y: 0 },
        { x: -x, y: 0 },
        { x: 0, y },
        { x: 0, y: -y },
      ]
    : [
        { x, y },
        { x: -x, y },
        { x, y: -y },
        { x: -x, y: -y },
      ];
}

/**
 * How far along `direction` a ray from `local`, a point inside the shape and
 * relative to its centre, travels before leaving the outline.
 */
function exitScale(
  kind: ShapeKind,
  local: Point,
  direction: Point,
  halfWidth: number,
  halfHeight: number,
): number {
  if (kind === 'ellipse') {
    // Solve ((x + t·dx)/a)² + ((y + t·dy)/b)² = 1 for its positive root.
    const a = (direction.x / halfWidth) ** 2 + (direction.y / halfHeight) ** 2;
    const b =
      2 * ((local.x * direction.x) / halfWidth ** 2 + (local.y * direction.y) / halfHeight ** 2);
    const c = (local.x / halfWidth) ** 2 + (local.y / halfHeight) ** 2 - 1;
    return (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  }

  // A convex polygon: the ray leaves through the first side it is heading for.
  let nearest = Number.POSITIVE_INFINITY;
  for (const normal of halfPlanes(kind, halfWidth, halfHeight)) {
    const towards = normal.x * direction.x + normal.y * direction.y;
    if (towards > EPSILON) {
      const distance = (1 - (normal.x * local.x + normal.y * local.y)) / towards;
      nearest = Math.min(nearest, distance);
    }
  }
  return nearest;
}

/**
 * Where a ray from `origin`, a point inside the shape, leaves the outline.
 *
 * `boundaryPoint` is the special case with the origin at the centre. This one
 * is for lines that do not pass through the centre, such as the two lines of
 * total participation. A zero direction, an origin outside the shape, or a
 * shape with no area all return `origin`, so a caller never sees NaN.
 */
export function exitPoint(box: ShapeBox, origin: Point, direction: Point): Point {
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;

  if (isZero(direction) || halfWidth <= EPSILON || halfHeight <= EPSILON) {
    return { ...origin };
  }
  if (!containsPoint(box, origin)) {
    return { ...origin };
  }

  const local = subtract(origin, box.center);
  return add(
    origin,
    scale(direction, exitScale(box.kind, local, direction, halfWidth, halfHeight)),
  );
}
