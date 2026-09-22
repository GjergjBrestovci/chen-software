import type { Point } from './types';

/** Below this, a length counts as zero. Keeps degenerate cases off NaN. */
export const EPSILON = 1e-9;

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(vector: Point, factor: number): Point {
  return { x: vector.x * factor, y: vector.y * factor };
}

export function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

export function distance(a: Point, b: Point): number {
  return length(subtract(a, b));
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function isZero(vector: Point): boolean {
  return length(vector) < EPSILON;
}

/** Unit vector, or `{ x: 0, y: 0 }` for a zero-length input. */
export function normalize(vector: Point): Point {
  const magnitude = length(vector);
  return magnitude < EPSILON ? { x: 0, y: 0 } : scale(vector, 1 / magnitude);
}

/** Rotates a vector 90 degrees counter-clockwise in screen coordinates (y grows downwards). */
export function perpendicular(vector: Point): Point {
  return { x: vector.y, y: -vector.x };
}
