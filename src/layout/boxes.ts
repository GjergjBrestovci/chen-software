import { boxFromTopLeft, shapeSizeFor, topLeftOf } from '../geometry';
import type { ShapeBox } from '../geometry';
import type { ErDocument, Id, Position } from '../model/types';

const ORIGIN: Position = { x: 0, y: 0 };

/**
 * Absolute boxes for every element that can be placed, in owner-before-part
 * order.
 *
 * Attribute positions are offsets from their owner, and a part of a composite
 * is offset from the composite, so absolute positions have to accumulate down
 * the chain. Attributes are placed in waves until a wave adds nothing; anything
 * left has a missing or cyclic owner, which the schema rejects on import, and
 * is skipped rather than drawn in the wrong place.
 */
export function absoluteBoxes(document: ErDocument): Map<Id, ShapeBox> {
  const { model, layout } = document;
  const positionOf = (id: Id): Position => layout.positions[id] ?? ORIGIN;
  const boxes = new Map<Id, ShapeBox>();

  for (const entity of model.entities) {
    boxes.set(
      entity.id,
      boxFromTopLeft('rect', positionOf(entity.id), shapeSizeFor('rect', entity.name)),
    );
  }
  for (const relationship of model.relationships) {
    boxes.set(
      relationship.id,
      boxFromTopLeft(
        'diamond',
        positionOf(relationship.id),
        shapeSizeFor('diamond', relationship.name),
      ),
    );
  }

  let unplaced = [...model.attributes];
  for (;;) {
    const ready = unplaced.flatMap((attribute) => {
      const owner = boxes.get(attribute.ownerId);
      return owner ? [{ attribute, owner }] : [];
    });
    if (ready.length === 0) {
      break;
    }

    for (const { attribute, owner } of ready) {
      const ownerTopLeft = topLeftOf(owner);
      const offset = positionOf(attribute.id);
      boxes.set(
        attribute.id,
        boxFromTopLeft(
          'ellipse',
          { x: ownerTopLeft.x + offset.x, y: ownerTopLeft.y + offset.y },
          shapeSizeFor('ellipse', attribute.name),
        ),
      );
    }

    const placed = new Set(ready.map(({ attribute }) => attribute.id));
    unplaced = unplaced.filter((attribute) => !placed.has(attribute.id));
  }

  return boxes;
}
