import { edgeDirection, edgeLength, floatingEdge, pointAlongEdge } from './edges';
import type { EdgeSegment } from './edges';
import { measureTextWidth, textLineHeight } from './textMetrics';
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
 * Which side of an end's line its labels go on. `left` and `right` are relative
 * to the direction from the entity to the relationship; `auto` applies the
 * shared above-or-right rule.
 */
export type LabelSide = 'auto' | 'left' | 'right';

/**
 * The side that faces away from the other lines of a spread end, given the
 * offset `spreadOffsets` chose for it. Labels on the two lines of a
 * self-relationship then sit outside the pair instead of between them.
 */
export function sideForOffset(offset: number): LabelSide {
  if (offset > EPSILON) return 'left';
  if (offset < -EPSILON) return 'right';
  return 'auto';
}

function sideNormal(direction: Point, side: LabelSide): Point {
  const left = perpendicular(direction);
  switch (side) {
    case 'auto':
      return labelNormal(direction);
    case 'left':
      return left;
    case 'right':
      return scale(left, -1);
  }
}

/** Font size of a role name on a self-relationship end (SPEC.md §6). */
export const ROLE_FONT_SIZE = 11;

const DEFAULT_ROLE_CLEARANCE = 10;

export interface EndLabelOptions extends CardinalityLabelOptions {
  side?: LabelSide;
  /** This end's role name, if it has one. */
  role?: string | null;
  /**
   * Room between the cardinality label's centre and the near edge of the role
   * name, so the two never overlap.
   */
  roleClearance?: number;
}

export interface EndLabelPlacement extends CardinalityLabelPlacement {
  /** Centre of the role name, or `null` when the end has none. */
  rolePosition: Point | null;
}

/**
 * How far a box of `width` by `height` reaches from its centre in the direction
 * `normal`, so text can be pushed clear of a line whatever the line's angle.
 */
function halfExtentAlong(normal: Point, width: number, height: number): number {
  return (Math.abs(normal.x) * width + Math.abs(normal.y) * height) / 2;
}

/**
 * Places the labels for one end of a relationship on `segment`, a line that
 * runs from the entity to the relationship. The segment may be offset from the
 * centre line, as it is for the ends of a self-relationship.
 *
 * The role name goes on the same side as the cardinality and further out,
 * pushed clear by its own measured size, so a long name never crosses the line
 * and never covers the cardinality.
 */
export function endLabelPlacement(
  segment: EdgeSegment,
  options: EndLabelOptions = {},
): EndLabelPlacement {
  const settings = { ...DEFAULTS, ...options };
  const direction = edgeDirection(segment);
  const role = options.role ?? null;

  if (isZero(direction)) {
    // The shapes overlap; anywhere sensible beats NaN.
    return {
      position: { ...segment.start },
      attachment: { ...segment.start },
      rolePosition: role === null ? null : { ...segment.start },
    };
  }

  const travelled = Math.min(
    settings.distanceFromEntity,
    edgeLength(segment) * settings.maxEdgeFraction,
  );
  const attachment = pointAlongEdge(segment, travelled);
  const normal = sideNormal(direction, options.side ?? 'auto');
  const position = add(attachment, scale(normal, settings.perpendicularOffset));

  if (role === null) {
    return { position, attachment, rolePosition: null };
  }

  const reach = halfExtentAlong(
    normal,
    measureTextWidth(role, ROLE_FONT_SIZE),
    textLineHeight(ROLE_FONT_SIZE),
  );
  const roleClearance = options.roleClearance ?? DEFAULT_ROLE_CLEARANCE;
  const rolePosition = add(
    attachment,
    scale(normal, settings.perpendicularOffset + roleClearance + reach),
  );

  return { position, attachment, rolePosition };
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
  const { position, attachment } = endLabelPlacement(floatingEdge(entity, relationship), options);
  return { position, attachment };
}
