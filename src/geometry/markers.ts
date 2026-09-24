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

/**
 * Marker artwork, in a `MARKER_SIZE` box with its origin at the top left.
 * Shared by the canvas and the PDF so the two cannot draw different shapes.
 */
export const CROWN_PATH = 'M1 9 L1 2.5 L4 5.5 L7 1.5 L10 5.5 L13 2.5 L13 9 Z';

/** A plug on a lead: two prongs and the trailing cable, stroked. */
export const PLUG_STROKE_PATH = 'M4.6 0.8 L4.6 3.4 M9.4 0.8 L9.4 3.4 M7 7.6 L7 10.4';

/** The body of the plug, filled. */
export const PLUG_BODY = { x: 2.6, y: 3.4, width: 8.8, height: 4.2, radius: 1.3 } as const;

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
