import { edgeDirection, edgeLength, floatingEdge, pointAlongEdge } from './edges';
import type { Point, ShapeBox } from './types';
import { add, EPSILON, isZero, perpendicular, scale } from './vectors';

/**
 * Placement of a cardinality label (SPEC.md §5): beside the entity it counts,
 * about 20 px from that entity's boundary along the edge, pushed sideways so it
 * does not sit on the line.
 */

export interface CardinalityLabelOptions {
  /** Distance from the entity boundary along the edge. */
  distanceFromEntity?: number;
  /**
   * Cap on that distance as a fraction of the edge. SPEC.md says "~20 px", but
   * a fixed 20 px pushes the label past the diamond when the two shapes are
   * close, so it is clamped.
   */
  maxEdgeFraction?: number;
  /** How far to push the label off the line. */
  perpendicularOffset?: number;
}

const DEFAULTS: Required<CardinalityLabelOptions> = {
  distanceFromEntity: 20,
  maxEdgeFraction: 0.35,
  perpendicularOffset: 12,
};

/**
 * Which side of the line the label sits on.
 *
 * Both ends of one relationship must agree, or the two labels look unrelated.
 * The rule: always above the line, and for a vertical line, always to the
 * right. It depends only on the line's orientation, never on which end is
 * being drawn.
 */
function labelNormal(direction: Point): Point {
  const normal = perpendicular(direction);
  if (normal.y < -EPSILON) {
    return normal;
  }
  if (normal.y > EPSILON) {
    return { x: -normal.x, y: -normal.y };
  }
  return normal.x >= 0 ? normal : { x: -normal.x, y: -normal.y };
}

export interface CardinalityLabelPlacement {
  /** Centre of the label. */
  position: Point;
  /** Point on the entity boundary the label refers to. */
  attachment: Point;
}

/**
 * Places the label for the end of `relationship` that counts `entity`.
 *
 * Pure and layout-only: which letter is drawn comes from the model, and moving
 * shapes can never change validation (SPEC.md §1.3).
 */
export function cardinalityLabelPlacement(
  entity: ShapeBox,
  relationship: ShapeBox,
  options: CardinalityLabelOptions = {},
): CardinalityLabelPlacement {
  const settings = { ...DEFAULTS, ...options };
  const segment = floatingEdge(entity, relationship);
  const direction = edgeDirection(segment);

  if (isZero(direction)) {
    // The shapes overlap; anywhere sensible beats NaN.
    return { position: { ...segment.start }, attachment: { ...segment.start } };
  }

  const travelled = Math.min(
    settings.distanceFromEntity,
    edgeLength(segment) * settings.maxEdgeFraction,
  );
  const attachment = pointAlongEdge(segment, travelled);
  const position = add(attachment, scale(labelNormal(direction), settings.perpendicularOffset));

  return { position, attachment };
}
