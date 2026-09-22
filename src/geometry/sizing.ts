import { textBoxSize } from './textMetrics';
import type { ShapeKind, Size } from './types';

/**
 * Auto-sizing shapes to their text (SPEC.md §5).
 *
 * Each shape must contain a centred text box of half-width `u` and half-height
 * `v`, and each outline needs a different amount of room for the same box:
 *
 * - rect: the box is the box, so `A = u`, `B = v`.
 * - ellipse: `(u/A)² + (v/B)² ≤ 1`. The smallest such ellipse takes
 *   `A = u·√2`, `B = v·√2`.
 * - diamond: `u/A + v/B ≤ 1` would give `A = 2u`, `B = 2v`, which makes very
 *   wide diamonds for long relationship names. Text only needs to fit within
 *   the band it actually occupies, where the available half-width is
 *   `A·(1 − v/B)`. Fixing the height at `B = k·v` therefore allows
 *   `A = u/(1 − 1/k)`. `k = 2.5` trades a little height for a much narrower
 *   diamond.
 *
 * `A` and `B` are half-extents, so the returned size is `2A × 2B`, floored at
 * the per-kind minimum.
 */

const DIAMOND_HEIGHT_FACTOR = 2.5;

export interface ShapeMetrics {
  fontSize: number;
  paddingX: number;
  paddingY: number;
  minWidth: number;
  minHeight: number;
}

export const SHAPE_METRICS: Readonly<Record<ShapeKind, ShapeMetrics>> = {
  rect: { fontSize: 14, paddingX: 20, paddingY: 14, minWidth: 120, minHeight: 56 },
  diamond: { fontSize: 13, paddingX: 10, paddingY: 8, minWidth: 130, minHeight: 74 },
  ellipse: { fontSize: 12, paddingX: 10, paddingY: 6, minWidth: 96, minHeight: 46 },
};

/** Font size a shape kind draws its name at. */
export function fontSizeFor(kind: ShapeKind): number {
  return SHAPE_METRICS[kind].fontSize;
}

function halfExtents(kind: ShapeKind, u: number, v: number): { a: number; b: number } {
  switch (kind) {
    case 'rect':
      return { a: u, b: v };
    case 'ellipse':
      return { a: u * Math.SQRT2, b: v * Math.SQRT2 };
    case 'diamond':
      return { a: u / (1 - 1 / DIAMOND_HEIGHT_FACTOR), b: v * DIAMOND_HEIGHT_FACTOR };
  }
}

/** Smallest size of `kind` that contains `text`, never below the kind's minimum. */
export function shapeSizeFor(kind: ShapeKind, text: string, fontSize?: number): Size {
  const metrics = SHAPE_METRICS[kind];
  const textBox = textBoxSize(text, fontSize ?? metrics.fontSize);

  const u = textBox.width / 2 + metrics.paddingX;
  const v = textBox.height / 2 + metrics.paddingY;
  const { a, b } = halfExtents(kind, u, v);

  return {
    width: Math.max(metrics.minWidth, 2 * a),
    height: Math.max(metrics.minHeight, 2 * b),
  };
}
