import type { Point, ShapeBox, Size } from './types';

/**
 * Placement of the crown and cable markers that sit above an attribute
 * (SPEC.md §6).
 *
 * Pure, like every other measurement, so the canvas and the PDF exporter put
 * them in the same place. Returned relative to the shape's centre, which is
 * what both an absolutely-positioned DOM node and an SVG transform need.
 */

/** Default marker footprint, in pixels. */
export const MARKER_SIZE: Size = { width: 14, height: 11 };

/** Gap between two markers, and between the markers and the shape. */
const MARKER_GAP = 4;

/**
 * Centres for `count` markers, evenly spaced and centred above the shape.
 * Relative to `box.center`; negative `y` is above.
 */
export function markerSlots(box: ShapeBox, count: number, size: Size = MARKER_SIZE): Point[] {
  if (count <= 0) {
    return [];
  }

  const rowWidth = count * size.width + (count - 1) * MARKER_GAP;
  const firstX = -rowWidth / 2 + size.width / 2;
  const y = -(box.size.height / 2 + MARKER_GAP + size.height / 2);

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * (size.width + MARKER_GAP),
    y,
  }));
}
