import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
  setCardinality,
} from '../../model/operations';
import { readDocumentJson } from '../../persistence/migrations';
import type { ErDocument } from '../../model/types';
import { distance, shapeSizeFor } from '../../geometry';
import type { Point, ShapeBox } from '../../geometry';
import { ANCHOR_HANDLE_ID } from '../nodes/AnchorHandle';
import { attributeEdgeId, buildScene, cardinalityEdgeId, midpointBetween } from '../scene';
import type { AppNode } from '../scene';

function bookstore(): ErDocument {
  const outcome = readDocumentJson(
    readFileSync(new URL('../../../fixtures/bookstore.erd.json', import.meta.url), 'utf8'),
  );
  if (!outcome.ok) {
    throw new Error(outcome.message);
  }
  return outcome.value.document;
}

function sample(): ErDocument {
  let document = createEmptyDocument();
  document = addEntity(document, { id: 'pub', name: 'PUBLISHER', position: { x: 0, y: 0 } });
  document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 600, y: 0 } });
  document = addRelationship(document, {
    id: 'rel',
    name: 'published_by',
    entityIds: ['pub', 'book'],
    position: { x: 300, y: 0 },
  });
  document = addAttribute(document, {
    id: 'isbn',
    ownerId: 'book',
    name: 'isbn',
    identifier: 'key',
    offset: { x: 20, y: 140 },
  });
  return document;
}

function scene(document: ErDocument, overrides = {}) {
  return buildScene({ document, selectedIds: [], renamingId: null, ...overrides });
}

/** Distance from a point to a shape's outline, normalised (0 = exactly on it). */
function outlineResidual(shape: ShapeBox, point: Point): number {
  const dx = Math.abs(point.x - shape.center.x) / (shape.size.width / 2);
  const dy = Math.abs(point.y - shape.center.y) / (shape.size.height / 2);
  switch (shape.kind) {
    case 'rect':
      return Math.abs(Math.max(dx, dy) - 1);
    case 'diamond':
      return Math.abs(dx + dy - 1);
    case 'ellipse':
      return Math.abs(Math.hypot(dx, dy) - 1);
  }
}

function nodeOf(nodes: AppNode[], id: string): AppNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`no node ${id}`);
  }
  return node;
}

describe('buildScene nodes', () => {
  it('builds one node per element', () => {
    const { nodes } = scene(sample());
    expect(nodes).toHaveLength(4);
    expect(nodes.map((node) => node.type).sort()).toEqual([
      'attribute',
      'entity',
      'entity',
      'relationship',
    ]);
  });

  it('draws each element with its Chen outline', () => {
    const { nodes } = scene(sample());
    expect(nodeOf(nodes, 'pub').type).toBe('entity');
    expect(nodeOf(nodes, 'rel').type).toBe('relationship');
    expect(nodeOf(nodes, 'isbn').type).toBe('attribute');
  });

  it('sizes every node with the shared geometry, so the PDF will match', () => {
    const { nodes } = scene(sample());
    const book = nodeOf(nodes, 'book');
    expect({ width: book.width, height: book.height }).toEqual(shapeSizeFor('rect', 'BOOK'));
  });

  it('parents an attribute to its owner, so dragging the owner moves it', () => {
    const { nodes } = scene(sample());
    expect(nodeOf(nodes, 'isbn').parentId).toBe('book');
  });

  it('never restricts an attribute to its parent, so it stays individually draggable', () => {
    const { nodes } = scene(sample());
    expect(nodeOf(nodes, 'isbn').extent).toBeUndefined();
  });

  it('lists every parent before its children, as React Flow requires', () => {
    const { nodes } = scene(bookstore());
    const seen = new Set<string>();
    for (const node of nodes) {
      if (node.parentId !== undefined) {
        expect(seen.has(node.parentId)).toBe(true);
      }
      seen.add(node.id);
    }
  });

  it('keeps an attribute position relative to its owner', () => {
    const { nodes } = scene(sample());
    expect(nodeOf(nodes, 'isbn').position).toEqual({ x: 20, y: 140 });
  });

  it('marks key attributes so the name can be underlined', () => {
    const { nodes } = scene(sample());
    const isbn = nodeOf(nodes, 'isbn');
    expect(isbn.type === 'attribute' && isbn.data.isKey).toBe(true);
  });

  it('carries selection through from the UI store', () => {
    const { nodes } = scene(sample(), { selectedIds: ['book'] });
    expect(nodeOf(nodes, 'book').selected).toBe(true);
    expect(nodeOf(nodes, 'pub').selected).toBe(false);
  });

  it('flags only the element being renamed', () => {
    const { nodes } = scene(sample(), { renamingId: 'rel' });
    const rel = nodeOf(nodes, 'rel');
    const book = nodeOf(nodes, 'book');
    expect(rel.data.renaming).toBe(true);
    expect(book.data.renaming).toBe(false);
  });

  it('prefers a live drag position over the saved one', () => {
    const { nodes, boxes } = scene(sample(), { dragPositions: { book: { x: 999, y: 111 } } });
    expect(nodeOf(nodes, 'book').position).toEqual({ x: 999, y: 111 });
    expect(boxes.get('book')?.center.x).toBeGreaterThan(900);
  });

  it('moves an attribute box when its owner is dragged', () => {
    const still = scene(sample()).boxes.get('isbn');
    const dragged = scene(sample(), { dragPositions: { book: { x: 800, y: 0 } } }).boxes.get(
      'isbn',
    );
    expect(dragged?.center.x).toBeCloseTo((still?.center.x ?? 0) + 200, 6);
  });

  it('falls back to the origin for an element with no saved position', () => {
    const document = sample();
    const stripped: ErDocument = { ...document, layout: { positions: {} } };
    expect(nodeOf(scene(stripped).nodes, 'book').position).toEqual({ x: 0, y: 0 });
  });
});

describe('buildScene edges', () => {
  it('draws one line per attribute and two per relationship', () => {
    const { edges } = scene(sample());
    expect(edges.map((edge) => edge.id).sort()).toEqual([
      attributeEdgeId('isbn'),
      cardinalityEdgeId('rel', 0),
      cardinalityEdgeId('rel', 1),
    ]);
  });

  it('connects boundaries, not centres', () => {
    const { edges, boxes } = scene(sample());
    const edge = edges.find((candidate) => candidate.id === cardinalityEdgeId('rel', 0));
    const pub = boxes.get('pub');
    const diamond = boxes.get('rel');
    if (!edge?.data || !pub || !diamond) {
      throw new Error('expected a relationship edge between two boxes');
    }

    // Each endpoint sits exactly on its own outline, and the drawn line is
    // therefore shorter than the centre-to-centre line.
    expect(outlineResidual(pub, edge.data.segment.start)).toBeLessThan(1e-9);
    expect(outlineResidual(diamond, edge.data.segment.end)).toBeLessThan(1e-9);
    expect(distance(edge.data.segment.start, edge.data.segment.end)).toBeLessThan(
      distance(pub.center, diamond.center),
    );
  });

  it('gives attribute lines no cardinality label', () => {
    const { edges } = scene(sample());
    const edge = edges.find((candidate) => candidate.id === attributeEdgeId('isbn'));
    expect(edge?.data?.label).toBeNull();
  });

  it('puts each cardinality label beside the entity that end counts', () => {
    let document = sample();
    document = setCardinality(document, { relationshipId: 'rel', endIndex: 1, cardinality: 'N' });

    const { edges, boxes } = scene(document);
    const bookEnd = edges.find((candidate) => candidate.id === cardinalityEdgeId('rel', 1));
    const bookCenter = boxes.get('book')?.center.x ?? 0;
    const diamondCenter = boxes.get('rel')?.center.x ?? 0;

    expect(bookEnd?.data?.label?.value).toBe('N');
    const labelX = bookEnd?.data?.label?.position.x ?? 0;
    expect(Math.abs(labelX - bookCenter)).toBeLessThan(Math.abs(labelX - diamondCenter));
  });

  it('reports an unset cardinality as null, for the dashed placeholder', () => {
    const { edges } = scene(sample());
    const edge = edges.find((candidate) => candidate.id === cardinalityEdgeId('rel', 0));
    expect(edge?.data?.label?.value).toBeNull();
  });

  it('carries the end index, so clicking a label knows which end to change', () => {
    const { edges } = scene(sample());
    const first = edges.find((candidate) => candidate.id === cardinalityEdgeId('rel', 0));
    const second = edges.find((candidate) => candidate.id === cardinalityEdgeId('rel', 1));
    expect(first?.data?.label?.endIndex).toBe(0);
    expect(second?.data?.label?.endIndex).toBe(1);
  });

  it('names the anchor handle on both ends of every edge', () => {
    // React Flow silently drops an edge whose handle it cannot resolve, which
    // makes the whole diagram render as shapes with no lines between them.
    for (const edge of scene(bookstore()).edges) {
      expect(edge.sourceHandle).toBe(ANCHOR_HANDLE_ID);
      expect(edge.targetHandle).toBe(ANCHOR_HANDLE_ID);
    }
  });

  it('makes lines unselectable, so only shapes can be selected', () => {
    expect(scene(sample()).edges.every((edge) => edge.selectable === false)).toBe(true);
  });
});

describe('buildScene on the bookstore fixture', () => {
  it('renders every element of the reference diagram', () => {
    const { nodes, edges } = scene(bookstore());
    expect(nodes).toHaveLength(18);
    expect(edges).toHaveLength(17);
  });

  it('produces finite geometry throughout', () => {
    for (const box of scene(bookstore()).boxes.values()) {
      expect(Number.isFinite(box.center.x)).toBe(true);
      expect(Number.isFinite(box.center.y)).toBe(true);
      expect(box.size.width).toBeGreaterThan(0);
    }
  });

  it('does not change the model in any way', () => {
    const document = bookstore();
    const snapshot = structuredClone(document);
    scene(document);
    expect(document).toEqual(snapshot);
  });
});

describe('midpointBetween', () => {
  it('centres a new diamond between the two entities', () => {
    const { boxes } = scene(sample());
    const position = midpointBetween(boxes, 'pub', 'book', '');
    const size = shapeSizeFor('diamond', '');
    const pubCenter = boxes.get('pub')?.center.x ?? 0;
    const bookCenter = boxes.get('book')?.center.x ?? 0;
    expect(position.x + size.width / 2).toBeCloseTo((pubCenter + bookCenter) / 2, 6);
  });

  it('falls back to the origin when either id is unknown', () => {
    const { boxes } = scene(sample());
    for (const pair of [
      ['ghost', 'book'],
      ['book', 'ghost'],
      ['ghost', 'alsoGhost'],
    ] as const) {
      const position = midpointBetween(boxes, pair[0], pair[1], '');
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });
});

describe('buildScene is defensive about references', () => {
  /** Built by hand: the schema would reject these, but memory can still be wrong. */
  function danglingDocument(): ErDocument {
    const document = sample();
    return {
      ...document,
      model: {
        ...document.model,
        attributes: [
          ...document.model.attributes,
          {
            id: 'orphan',
            ownerId: 'ghost',
            ownerKind: 'entity',
            name: 'x',
            shape: 'simple',
            identifier: 'none',
            foreignKey: false,
          },
        ],
        relationships: [
          ...document.model.relationships,
          {
            id: 'ghostRel',
            name: 'nowhere',
            kind: 'regular',
            ends: [
              { entityId: 'ghost', cardinality: null, participation: 'partial', role: null },
              { entityId: 'alsoGhost', cardinality: null, participation: 'partial', role: null },
            ],
          },
        ],
      },
    };
  }

  it('skips an attribute line whose owner is missing', () => {
    const { edges } = scene(danglingDocument());
    expect(edges.some((edge) => edge.id === attributeEdgeId('orphan'))).toBe(false);
  });

  it('skips relationship ends whose entity is missing', () => {
    const { edges } = scene(danglingDocument());
    expect(edges.some((edge) => edge.source === 'ghost')).toBe(false);
  });

  it('still renders everything that is sound', () => {
    const { edges } = scene(danglingDocument());
    expect(edges.some((edge) => edge.id === attributeEdgeId('isbn'))).toBe(true);
    expect(edges.some((edge) => edge.id === cardinalityEdgeId('rel', 0))).toBe(true);
  });
});

describe('buildScene places composite attributes', () => {
  /** BOOK at (1000, 500) ← name(composite) ← first, each offset from its owner. */
  function nested(): ErDocument {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 1000, y: 500 } });
    document = addAttribute(document, {
      id: 'name',
      ownerId: 'book',
      name: 'name',
      shape: 'composite',
      offset: { x: 100, y: 200 },
    });
    document = addAttribute(document, {
      id: 'first',
      ownerId: 'name',
      name: 'first',
      offset: { x: 30, y: 60 },
    });
    return document;
  }

  it('parents a part to its composite, not to the entity', () => {
    const { nodes } = scene(nested());
    expect(nodeOf(nodes, 'first').parentId).toBe('name');
  });

  it('keeps a part position relative to its composite, as React Flow expects', () => {
    const { nodes } = scene(nested());
    expect(nodeOf(nodes, 'first').position).toEqual({ x: 30, y: 60 });
  });

  it('accumulates the absolute position down the whole chain', () => {
    const { boxes } = scene(nested());
    const first = boxes.get('first');
    const size = shapeSizeFor('ellipse', 'first');

    // 1000 + 100 + 30 for x, 500 + 200 + 60 for y, plus half the ellipse.
    expect(first?.center.x).toBeCloseTo(1130 + size.width / 2, 6);
    expect(first?.center.y).toBeCloseTo(760 + size.height / 2, 6);
  });

  it('draws the part line to its composite, not off into empty space', () => {
    const { edges, boxes } = scene(nested());
    const edge = edges.find((candidate) => candidate.id === attributeEdgeId('first'));
    const name = boxes.get('name');
    if (!edge?.data || !name) {
      throw new Error('expected a line from the part to its composite');
    }
    expect(outlineResidual(name, edge.data.segment.end)).toBeLessThan(1e-9);
  });

  it('lists a composite before its parts, whatever order the model is in', () => {
    const document = nested();
    const reversed: ErDocument = {
      ...document,
      model: { ...document.model, attributes: [...document.model.attributes].reverse() },
    };

    const ids = scene(reversed).nodes.map((node) => node.id);
    expect(ids.indexOf('name')).toBeLessThan(ids.indexOf('first'));
  });

  it('moves a part when the entity two levels up is dragged', () => {
    const still = scene(nested()).boxes.get('first');
    const dragged = scene(nested(), { dragPositions: { book: { x: 1400, y: 500 } } }).boxes.get(
      'first',
    );
    expect(dragged?.center.x).toBeCloseTo((still?.center.x ?? 0) + 400, 6);
  });

  it('skips an attribute whose owner cannot be placed at all', () => {
    const document = nested();
    const orphaned: ErDocument = {
      ...document,
      model: {
        ...document.model,
        attributes: document.model.attributes.map((attribute) =>
          attribute.id === 'name' ? { ...attribute, ownerId: 'ghost' } : attribute,
        ),
      },
    };

    const { nodes, edges } = scene(orphaned);
    // Neither the composite nor the part below it can be positioned.
    expect(nodes.map((node) => node.id)).toEqual(['book']);
    expect(edges).toEqual([]);
  });
});
