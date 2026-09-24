import {
  CARDINALITY_FONT_SIZE,
  DOUBLE_LINE_GAP,
  MARKER_SIZE,
  ROLE_FONT_SIZE,
  boundsOf,
  endLabelPlacement,
  floatingEdge,
  fontSizeFor,
  insetBox,
  markerSlots,
  measureTextWidth,
  offsetEdge,
  parallelEdges,
  sideForOffset,
  spreadOffset,
  textLineHeight,
  unionBounds,
} from '../geometry';
import type { Bounds, EdgeSegment, Point, ShapeBox } from '../geometry';
import { absoluteBoxes } from '../layout/boxes';
import { colorFor } from '../model/presentation';
import type { Attribute, Color, ElementKind, ErDocument, Id } from '../model/types';

/**
 * Everything a diagram draws, worked out from the document and the shared
 * geometry, with no knowledge of how it will be drawn (SPEC.md §6, §8).
 *
 * `renderSvg` turns this into an SVG for the PDF. It is the single place that
 * decides which shapes are doubled, which lines are spread or doubled, and
 * where every label goes, so a second renderer cannot disagree.
 */

export type Underline = 'none' | 'solid' | 'dashed';

/** Not Chen notation: a crown for a primary key, a plug for a foreign key. */
export type Marker = 'key' | 'foreign';

export interface DrawnShape {
  id: Id;
  kind: ElementKind;
  box: ShapeBox;
  /** Inner outline of a weak entity, identifying relationship or multivalued attribute. */
  inner: ShapeBox | null;
  /** A derived attribute has a dashed outline. */
  dashed: boolean;
  /** `null` means the interface ink. */
  color: Color | null;
  name: string;
  fontSize: number;
  underline: Underline;
  markers: Marker[];
}

export interface DrawnLabel {
  kind: 'cardinality' | 'role';
  text: string;
  /** Centre of the text. */
  position: Point;
  fontSize: number;
  /** A cardinality the student has not chosen yet, drawn as `?`. */
  unset: boolean;
}

export interface Drawing {
  shapes: DrawnShape[];
  /** Every line: attribute links, and relationship ends (a total end contributes two). */
  lines: EdgeSegment[];
  labels: DrawnLabel[];
  /** Everything that gets ink, or `null` for an empty diagram. */
  bounds: Bounds | null;
}

export const CARDINALITY_PLACEHOLDER = '?';

function underlineFor(attribute: Attribute | undefined): Underline {
  if (attribute?.identifier === 'key') return 'solid';
  if (attribute?.identifier === 'partial') return 'dashed';
  return 'none';
}

function markersFor(attribute: Attribute | undefined): Marker[] {
  const markers: Marker[] = [];
  if (attribute?.identifier === 'key') markers.push('key');
  if (attribute?.foreignKey) markers.push('foreign');
  return markers;
}

/** The rectangle a centred line of text occupies. */
function textBounds(center: Point, text: string, fontSize: number): Bounds {
  const halfWidth = measureTextWidth(text, fontSize) / 2;
  const halfHeight = textLineHeight(fontSize) / 2;
  return {
    minX: center.x - halfWidth,
    minY: center.y - halfHeight,
    maxX: center.x + halfWidth,
    maxY: center.y + halfHeight,
  };
}

function markerBounds(shape: DrawnShape): Bounds[] {
  return markerSlots(shape.box, shape.markers.length).map((slot) => ({
    minX: shape.box.center.x + slot.x - MARKER_SIZE.width / 2,
    minY: shape.box.center.y + slot.y - MARKER_SIZE.height / 2,
    maxX: shape.box.center.x + slot.x + MARKER_SIZE.width / 2,
    maxY: shape.box.center.y + slot.y + MARKER_SIZE.height / 2,
  }));
}

export function describeDiagram(document: ErDocument): Drawing {
  const { model, presentation } = document;
  const boxes = absoluteBoxes(document);
  const shapes: DrawnShape[] = [];
  const lines: EdgeSegment[] = [];
  const labels: DrawnLabel[] = [];

  const shape = (
    id: Id,
    kind: ElementKind,
    name: string,
    doubled: boolean,
    attribute?: Attribute,
  ): void => {
    const box = boxes.get(id);
    if (!box) {
      return;
    }
    shapes.push({
      id,
      kind,
      box,
      inner: doubled ? insetBox(box) : null,
      dashed: attribute?.shape === 'derived',
      color: colorFor(presentation, id, kind),
      name,
      fontSize: fontSizeFor(box.kind),
      underline: underlineFor(attribute),
      markers: markersFor(attribute),
    });
  };

  for (const entity of model.entities) {
    shape(entity.id, 'entity', entity.name, entity.kind === 'weak');
  }
  for (const relationship of model.relationships) {
    shape(relationship.id, 'relationship', relationship.name, relationship.kind === 'identifying');
  }
  for (const attribute of model.attributes) {
    shape(attribute.id, 'attribute', attribute.name, attribute.shape === 'multivalued', attribute);

    const from = boxes.get(attribute.id);
    const to = boxes.get(attribute.ownerId);
    if (from && to) {
      lines.push(floatingEdge(from, to));
    }
  }

  for (const relationship of model.relationships) {
    // absoluteBoxes places every relationship unconditionally; only attributes
    // can be left out. SPEC.md §10 allows an assertion with this explanation.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const diamond = boxes.get(relationship.id)!;

    // Ends that share an entity each get their own line, labels included.
    const seen = new Map<Id, number>();

    for (const end of relationship.ends) {
      const entity = boxes.get(end.entityId);
      if (!entity) {
        continue;
      }
      const index = seen.get(end.entityId) ?? 0;
      seen.set(end.entityId, index + 1);
      const sharing = relationship.ends.filter((other) => other.entityId === end.entityId).length;
      const offset = spreadOffset(index, sharing);

      if (end.participation === 'total') {
        lines.push(...parallelEdges(entity, diamond, DOUBLE_LINE_GAP, offset));
      } else {
        lines.push(offsetEdge(entity, diamond, offset));
      }

      const placement = endLabelPlacement(offsetEdge(entity, diamond, offset), {
        side: sideForOffset(offset),
        role: end.role,
      });
      labels.push({
        kind: 'cardinality',
        text: end.cardinality ?? CARDINALITY_PLACEHOLDER,
        position: placement.position,
        fontSize: CARDINALITY_FONT_SIZE,
        unset: end.cardinality === null,
      });
      if (end.role !== null && placement.rolePosition) {
        labels.push({
          kind: 'role',
          text: end.role,
          position: placement.rolePosition,
          fontSize: ROLE_FONT_SIZE,
          unset: false,
        });
      }
    }
  }

  const bounds = unionBounds([
    ...shapes.map((drawn) => boundsOf(drawn.box)),
    ...shapes.flatMap(markerBounds),
    ...labels.map((label) => textBounds(label.position, label.text, label.fontSize)),
  ]);

  return { shapes, lines, labels, bounds };
}
