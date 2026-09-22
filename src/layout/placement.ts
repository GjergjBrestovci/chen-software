import { shapeSizeFor } from '../geometry';
import type { Size } from '../geometry';
import { ModelError } from '../model/errors';
import { attributesOf, findElementRef } from '../model/queries';
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
  const owner = findElementRef(model, ownerId);
  if (!owner) {
    throw new ModelError(`Unknown attribute owner "${ownerId}".`);
  }

  // A composite attribute owns its parts, so an owner may itself be an ellipse.
  const ownerSize = shapeSizeFor(shapeKindFor(owner.kind), owner.name);
  const newSize = shapeSizeFor('ellipse', attributeName);
  const existing = attributesOf(model, ownerId).map((attribute) => ({
    offset: document.layout.positions[attribute.id] ?? { x: 0, y: 0 },
    size: shapeSizeFor('ellipse', attribute.name),
  }));

  return findFreeOffset({ ownerSize, newSize, existing }, options);
}

/** Horizontal step between elements placed in the repair row. */
const REPAIR_COLUMN = 220;
/** Vertical step, and the gap below existing content. */
const REPAIR_ROW = 160;
/** Elements per repair row before wrapping. */
const REPAIR_PER_ROW = 6;

function isPositioned(document: ErDocument, id: Id, missing: ReadonlySet<Id>): boolean {
  return !missing.has(id) && Object.hasOwn(document.layout.positions, id);
}

/**
 * Gives a position to elements that arrived without one.
 *
 * An imported file with a missing `layout.positions` entry is not malformed:
 * layout cannot affect correctness, so the element is placed rather than the
 * whole file being rejected or the element being dropped, which would mean the
 * app editing the student's model (SPEC.md §1, product rule 1).
 *
 * Entities and relationships go in a row below whatever is already positioned,
 * so they never land on top of existing work. Attributes then use the ordinary
 * free-spot search around their owner.
 */
export function placeMissingPositions(document: ErDocument, missingIds: readonly Id[]): ErDocument {
  const missing = new Set(missingIds);
  if (missing.size === 0) {
    return document;
  }

  const positions = { ...document.layout.positions };
  const { model } = document;

  const placed = [...model.entities, ...model.relationships].filter((element) =>
    isPositioned(document, element.id, missing),
  );
  const bottom = placed.reduce(
    (lowest, element) => Math.max(lowest, positions[element.id]?.y ?? 0),
    0,
  );
  const left = placed.reduce(
    (leftmost, element) => Math.min(leftmost, positions[element.id]?.x ?? 0),
    placed.length > 0 ? Number.POSITIVE_INFINITY : 0,
  );

  let index = 0;
  for (const element of [...model.entities, ...model.relationships]) {
    if (!missing.has(element.id)) {
      continue;
    }
    positions[element.id] = {
      x: left + (index % REPAIR_PER_ROW) * REPAIR_COLUMN,
      y: bottom + REPAIR_ROW * (1 + Math.floor(index / REPAIR_PER_ROW)),
    };
    index += 1;
  }

  // Attributes last: the search reads its siblings' positions as it goes.
  let repaired: ErDocument = { ...document, layout: { positions } };
  for (const attribute of model.attributes) {
    if (!missing.has(attribute.id)) {
      continue;
    }
    positions[attribute.id] = attributeOffsetFor(repaired, attribute.ownerId, attribute.name);
    repaired = { ...document, layout: { positions } };
  }

  return repaired;
}
