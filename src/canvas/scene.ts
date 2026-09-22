/* eslint-disable @typescript-eslint/consistent-type-definitions --
   React Flow constrains node and edge data to `Record<string, unknown>`. A type
   alias gets an implicit index signature and satisfies that; an interface does
   not. These must stay `type`. */
import type { Edge, Node } from '@xyflow/react';
import {
  boxFromTopLeft,
  cardinalityLabelPlacement,
  floatingEdge,
  shapeSizeFor,
  topLeftOf,
} from '../geometry';
import type { EdgeSegment, Point, ShapeBox } from '../geometry';
import { ANCHOR_HANDLE_ID } from './nodes/AnchorHandle';
import type {
  Attribute,
  Cardinality,
  ErDocument,
  Id,
  Position,
  Relationship,
} from '../model/types';

/**
 * Turns the document into the nodes and edges React Flow renders.
 *
 * Pure, and deliberately one-directional: the canvas never edits this output,
 * it dispatches actions on `documentStore` and the next scene is rebuilt. That
 * is what keeps "moving shapes never changes validation" (SPEC.md §1.3) true by
 * construction rather than by discipline.
 *
 * Every measurement comes from `geometry/`, the same functions the PDF exporter
 * will use, so the export cannot drift from what the student sees.
 */

export type EntityNodeData = { label: string; renaming: boolean };
export type RelationshipNodeData = { label: string; renaming: boolean };
export type AttributeNodeData = { label: string; renaming: boolean; isKey: boolean };

export type AppNode =
  | Node<EntityNodeData, 'entity'>
  | Node<RelationshipNodeData, 'relationship'>
  | Node<AttributeNodeData, 'attribute'>;

export type CardinalityLabel = {
  relationshipId: Id;
  endIndex: number;
  value: Cardinality | null;
  position: Point;
};

export type ChenEdgeData = {
  segment: EdgeSegment;
  /** Present on relationship edges, absent on attribute-to-owner lines. */
  label: CardinalityLabel | null;
};

export type AppEdge = Edge<ChenEdgeData, 'chen'>;

export interface SceneInput {
  document: ErDocument;
  selectedIds: readonly Id[];
  renamingId: Id | null;
  /** Live positions while dragging, in the same space as `layout.positions`. */
  dragPositions?: Readonly<Record<Id, Position>>;
}

export interface Scene {
  nodes: AppNode[];
  edges: AppEdge[];
  /** Absolute boxes, keyed by element id. Exposed for hit-testing and tests. */
  boxes: Map<Id, ShapeBox>;
}

const ORIGIN: Position = { x: 0, y: 0 };

export function cardinalityEdgeId(relationshipId: Id, endIndex: number): string {
  return `card:${relationshipId}:${String(endIndex)}`;
}

export function attributeEdgeId(attributeId: Id): string {
  return `attr:${attributeId}`;
}

export function buildScene(input: SceneInput): Scene {
  const { document, renamingId } = input;
  const { model, layout } = document;
  const selected = new Set(input.selectedIds);
  const drag = input.dragPositions ?? {};

  const positionOf = (id: Id): Position => drag[id] ?? layout.positions[id] ?? ORIGIN;

  const nodes: AppNode[] = [];
  const boxes = new Map<Id, ShapeBox>();
  const placedAttributes: { attribute: Attribute; box: ShapeBox; ownerBox: ShapeBox }[] = [];
  const placedRelationships: { relationship: Relationship; box: ShapeBox }[] = [];

  for (const entity of model.entities) {
    const size = shapeSizeFor('rect', entity.name);
    const position = positionOf(entity.id);
    nodes.push({
      id: entity.id,
      type: 'entity',
      position,
      width: size.width,
      height: size.height,
      selected: selected.has(entity.id),
      data: { label: entity.name, renaming: renamingId === entity.id },
    });
    boxes.set(entity.id, boxFromTopLeft('rect', position, size));
  }

  for (const relationship of model.relationships) {
    const size = shapeSizeFor('diamond', relationship.name);
    const position = positionOf(relationship.id);
    nodes.push({
      id: relationship.id,
      type: 'relationship',
      position,
      width: size.width,
      height: size.height,
      selected: selected.has(relationship.id),
      data: { label: relationship.name, renaming: renamingId === relationship.id },
    });
    const box = boxFromTopLeft('diamond', position, size);
    boxes.set(relationship.id, box);
    placedRelationships.push({ relationship, box });
  }

  /**
   * Attributes are placed owner-before-part, in waves.
   *
   * Two reasons, both load-bearing. React Flow needs a parent node to appear
   * before its children, and model order does not guarantee that. And a part of
   * a composite stores its offset relative to that composite, which is itself
   * relative to an entity, so the absolute position has to accumulate down the
   * chain rather than adding one stored offset to another.
   *
   * Anything still unplaced when a wave adds nothing has a missing or cyclic
   * owner. The schema rejects such a file, so this only guards a model damaged
   * in memory; those attributes are skipped rather than drawn in the wrong place.
   */
  let unplaced = [...model.attributes];

  for (;;) {
    // Pairing each attribute with its owner's box here means the edge loop
    // below never has to ask whether the owner exists.
    const ready = unplaced.flatMap((attribute) => {
      const ownerBox = boxes.get(attribute.ownerId);
      return ownerBox ? [{ attribute, ownerBox }] : [];
    });
    if (ready.length === 0) {
      break;
    }

    for (const { attribute, ownerBox } of ready) {
      const ownerTopLeft = topLeftOf(ownerBox);
      const size = shapeSizeFor('ellipse', attribute.name);
      const offset = positionOf(attribute.id);
      const topLeft = { x: ownerTopLeft.x + offset.x, y: ownerTopLeft.y + offset.y };

      nodes.push({
        id: attribute.id,
        type: 'attribute',
        // Relative to the owner, which is exactly what React Flow wants from a
        // child node, so dragging the owner moves it for free (SPEC.md §5).
        parentId: attribute.ownerId,
        position: offset,
        width: size.width,
        height: size.height,
        selected: selected.has(attribute.id),
        data: {
          label: attribute.name,
          renaming: renamingId === attribute.id,
          isKey: attribute.identifier !== 'none',
        },
      });

      const box = boxFromTopLeft('ellipse', topLeft, size);
      boxes.set(attribute.id, box);
      placedAttributes.push({ attribute, box, ownerBox });
    }

    const justPlaced = new Set(ready.map(({ attribute }) => attribute.id));
    unplaced = unplaced.filter((attribute) => !justPlaced.has(attribute.id));
  }

  const edges: AppEdge[] = [];

  for (const { attribute, box, ownerBox } of placedAttributes) {
    edges.push({
      id: attributeEdgeId(attribute.id),
      type: 'chen',
      source: attribute.id,
      target: attribute.ownerId,
      sourceHandle: ANCHOR_HANDLE_ID,
      targetHandle: ANCHOR_HANDLE_ID,
      selectable: false,
      data: { segment: floatingEdge(box, ownerBox), label: null },
    });
  }

  for (const { relationship, box: diamond } of placedRelationships) {
    relationship.ends.forEach((end, index) => {
      const entity = boxes.get(end.entityId);
      if (!entity) {
        return;
      }
      const placement = cardinalityLabelPlacement(entity, diamond);

      edges.push({
        id: cardinalityEdgeId(relationship.id, index),
        type: 'chen',
        source: end.entityId,
        target: relationship.id,
        sourceHandle: ANCHOR_HANDLE_ID,
        targetHandle: ANCHOR_HANDLE_ID,
        selectable: false,
        data: {
          segment: floatingEdge(entity, diamond),
          // The label belongs to the entity this end counts (SPEC.md §5).
          label: {
            relationshipId: relationship.id,
            endIndex: index,
            value: end.cardinality,
            position: placement.position,
          },
        },
      });
    });
  }

  return { nodes, edges, boxes };
}

/** Midpoint between two elements, used to place a new relationship diamond. */
export function midpointBetween(
  boxes: ReadonlyMap<Id, ShapeBox>,
  firstId: Id,
  secondId: Id,
  diamondName: string,
): Position {
  const first = boxes.get(firstId);
  const second = boxes.get(secondId);
  const size = shapeSizeFor('diamond', diamondName);

  const centerX = ((first?.center.x ?? 0) + (second?.center.x ?? 0)) / 2;
  const centerY = ((first?.center.y ?? 0) + (second?.center.y ?? 0)) / 2;

  return { x: centerX - size.width / 2, y: centerY - size.height / 2 };
}
