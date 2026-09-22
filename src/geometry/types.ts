export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The three outlines Chen notation needs (SPEC.md §5). */
export type ShapeKind = 'rect' | 'diamond' | 'ellipse';

/**
 * A shape as the geometry layer sees it: an outline, a centre and a size.
 *
 * Centres rather than top-left corners, because every boundary intersection is
 * expressed relative to the centre. `layout.positions` stores the top-left
 * corner that React Flow wants, so the canvas converts with `boxFromTopLeft`.
 */
export interface ShapeBox {
  kind: ShapeKind;
  center: Point;
  size: Size;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boxFromTopLeft(kind: ShapeKind, topLeft: Point, size: Size): ShapeBox {
  return {
    kind,
    center: { x: topLeft.x + size.width / 2, y: topLeft.y + size.height / 2 },
    size,
  };
}

export function topLeftOf(box: ShapeBox): Point {
  return {
    x: box.center.x - box.size.width / 2,
    y: box.center.y - box.size.height / 2,
  };
}

export function boundsOf(box: ShapeBox): Bounds {
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;
  return {
    minX: box.center.x - halfWidth,
    minY: box.center.y - halfHeight,
    maxX: box.center.x + halfWidth,
    maxY: box.center.y + halfHeight,
  };
}

/** Union of several bounds, or `null` when there is nothing to bound. */
export function unionBounds(all: readonly Bounds[]): Bounds | null {
  const [first, ...rest] = all;
  if (!first) {
    return null;
  }
  return rest.reduce<Bounds>(
    (accumulated, bounds) => ({
      minX: Math.min(accumulated.minX, bounds.minX),
      minY: Math.min(accumulated.minY, bounds.minY),
      maxX: Math.max(accumulated.maxX, bounds.maxX),
      maxY: Math.max(accumulated.maxY, bounds.maxY),
    }),
    first,
  );
}
