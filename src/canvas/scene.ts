/* eslint-disable @typescript-eslint/consistent-type-definitions --
   React Flow constrains node and edge data to `Record<string, unknown>`. A type
   alias gets an implicit index signature and satisfies that; an interface does
   not. These must stay `type`. */
import type { Edge, Node } from '@xyflow/react';
import { boxFromTopLeft, cardinalityLabelPlacement, floatingEdge, shapeSizeFor } from '../geometry';
import type { EdgeSegment, Point, ShapeBox } from '../geometry';
import { ANCHOR_HANDLE_ID } from './nodes/AnchorHandle';
import type {
  Attribute,
  Cardinality,
  EndIndex,
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
  endIndex: EndIndex;
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

export function cardinalityEdgeId(relationshipId: Id, endIndex: EndIndex): string {
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
  const placedAttributes: { attribute: Attribute; box: ShapeBox }[] = [];
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

  // Attributes come last: React Flow needs a parent node before its children.
  for (const attribute of model.attributes) {
    const size = shapeSizeFor('ellipse', attribute.name);
    const offset = positionOf(attribute.id);
    const ownerPosition = positionOf(attribute.ownerId);

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
        isKey: attribute.kind === 'key',
      },
    });

    const box = boxFromTopLeft(
      'ellipse',
      { x: ownerPosition.x + offset.x, y: ownerPosition.y + offset.y },
      size,
    );
    boxes.set(attribute.id, box);
    placedAttributes.push({ attribute, box });
  }

  const edges: AppEdge[] = [];

  for (const { attribute, box } of placedAttributes) {
    const owner = boxes.get(attribute.ownerId);
    if (!owner) {
      // Only reachable for a model damaged in memory; the schema rejects such
      // a file outright. Drawing nothing beats drawing a line to nowhere.
      continue;
    }
    edges.push({
      id: attributeEdgeId(attribute.id),
      type: 'chen',
      source: attribute.id,
      target: attribute.ownerId,
      sourceHandle: ANCHOR_HANDLE_ID,
      targetHandle: ANCHOR_HANDLE_ID,
      selectable: false,
      data: { segment: floatingEdge(box, owner), label: null },
    });
  }

  for (const { relationship, box: diamond } of placedRelationships) {
    relationship.ends.forEach((end, index) => {
      const entity = boxes.get(end.entityId);
      if (!entity) {
        return;
      }
      const endIndex = index as EndIndex;
      const placement = cardinalityLabelPlacement(entity, diamond);

      edges.push({
        id: cardinalityEdgeId(relationship.id, endIndex),
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
            endIndex,
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
