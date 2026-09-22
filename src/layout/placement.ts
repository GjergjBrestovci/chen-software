import { shapeSizeFor } from '../geometry';
import type { Size } from '../geometry';
import { ModelError } from '../model/errors';
import { attributesOf, findEntity, findRelationship } from '../model/queries';
import type { ErDocument, Id, Position } from '../model/types';
import { shapeKindFor } from './types';

/**
 * Finds a free spot for a new attribute around its owner (SPEC.md §5).
 *
 * This only ever chooses a *position*. It never invents, renames or reshapes
 * anything in the model, and layout can never change validation (SPEC.md §1.3).
 *
 * Offsets in and out are exactly what `layout.positions` stores for an
 * attribute: the top-left corner relative to the owner's top-left corner, which
 * is also what React Flow wants from a child node. The search itself works in
 * centre-relative space, so the conversion happens in one place.
 */

/**
 * Directions tried in order: below first, then above, the sides, and finally
 * the diagonals, which is roughly how a person fills a diagram in by hand.
 */
const ANGLES_DEGREES: readonly number[] = [
  90, -90, 180, 0, 135, 45, -135, -45, 112.5, 67.5, -112.5, -67.5,
];

export interface AttributePlacementOptions {
  /** Clear space kept between an attribute and its neighbours. */
  gap?: number;
  /** How much further out each successive ring sits. */
  ringStep?: number;
  /** Rings tried before giving up and using the last candidate. */
  maxRings?: number;
}

const DEFAULTS: Required<AttributePlacementOptions> = {
  gap: 24,
  ringStep: 44,
  maxRings: 6,
};

export interface ExistingAttribute {
  /** Top-left offset relative to the owner's top-left. */
  offset: Position;
  size: Size;
}

export interface AttributeSlotContext {
  ownerSize: Size;
  newSize: Size;
  existing: readonly ExistingAttribute[];
}

/** Axis-aligned overlap test, widened by `gap` on every side. */
function overlaps(a: Position, aSize: Size, b: Position, bSize: Size, gap: number): boolean {
  return (
    Math.abs(a.x - b.x) < (aSize.width + bSize.width) / 2 + gap &&
    Math.abs(a.y - b.y) < (aSize.height + bSize.height) / 2 + gap
  );
}

/** Pure slot search. Always returns a position, even when the ring budget runs out. */
export function findFreeOffset(
  context: AttributeSlotContext,
  options: AttributePlacementOptions = {},
): Position {
  const { gap, ringStep, maxRings } = { ...DEFAULTS, ...options };
  const { ownerSize, newSize, existing } = context;

  // Existing attributes, as centres relative to the owner's centre.
  const taken = existing.map((attribute) => ({
    center: {
      x: attribute.offset.x + attribute.size.width / 2 - ownerSize.width / 2,
      y: attribute.offset.y + attribute.size.height / 2 - ownerSize.height / 2,
    },
    size: attribute.size,
  }));

  const toOffset = (center: Position): Position => ({
    x: center.x + ownerSize.width / 2 - newSize.width / 2,
    y: center.y + ownerSize.height / 2 - newSize.height / 2,
  });

  let lastCandidate: Position = { x: 0, y: 0 };

  for (let ring = 0; ring < maxRings; ring += 1) {
    const radiusX = ownerSize.width / 2 + newSize.width / 2 + gap + ring * ringStep;
    const radiusY = ownerSize.height / 2 + newSize.height / 2 + gap + ring * ringStep;

    for (const degrees of ANGLES_DEGREES) {
      const radians = (degrees * Math.PI) / 180;
      const candidate = {
        x: Math.cos(radians) * radiusX,
        y: Math.sin(radians) * radiusY,
      };
      lastCandidate = candidate;

      const clashes = taken.some((other) =>
        overlaps(candidate, newSize, other.center, other.size, gap),
      );
      if (!clashes) {
        return toOffset(candidate);
      }
    }
  }

  return toOffset(lastCandidate);
}

/**
 * Free spot for a new attribute called `attributeName` on `ownerId`, sized with
 * the same `geometry/` functions the canvas and the PDF exporter use.
 */
export function attributeOffsetFor(
  document: ErDocument,
  ownerId: Id,
  attributeName: string,
  options: AttributePlacementOptions = {},
): Position {
  const { model } = document;
  const entity = findEntity(model, ownerId);
  const owner = entity ?? findRelationship(model, ownerId);
  if (!owner) {
    throw new ModelError(`Unknown attribute owner "${ownerId}".`);
  }

  const ownerSize = shapeSizeFor(shapeKindFor(entity ? 'entity' : 'relationship'), owner.name);
  const newSize = shapeSizeFor('ellipse', attributeName);
  const existing = attributesOf(model, ownerId).map((attribute) => ({
    offset: document.layout.positions[attribute.id] ?? { x: 0, y: 0 },
    size: shapeSizeFor('ellipse', attribute.name),
  }));

  return findFreeOffset({ ownerSize, newSize, existing }, options);
}
