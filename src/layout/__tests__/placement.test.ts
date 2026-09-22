import { describe, expect, it } from 'vitest';
import { shapeSizeFor } from '../../geometry';
import { ModelError } from '../../model/errors';
import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
} from '../../model/operations';
import type { ErDocument } from '../../model/types';
import { attributeOffsetFor, findFreeOffset, placeMissingPositions } from '../placement';
import type { AttributeSlotContext } from '../placement';

const OWNER = { width: 120, height: 60 };
const NEW = { width: 90, height: 46 };

function context(existing: AttributeSlotContext['existing'] = []): AttributeSlotContext {
  return { ownerSize: OWNER, newSize: NEW, existing };
}

/** Centre of a placed attribute, relative to the owner's centre. */
function centerOf(offset: { x: number; y: number }, size = NEW): { x: number; y: number } {
  return {
    x: offset.x + size.width / 2 - OWNER.width / 2,
    y: offset.y + size.height / 2 - OWNER.height / 2,
  };
}

describe('findFreeOffset', () => {
  it('puts the first attribute below its owner', () => {
    const center = centerOf(findFreeOffset(context()));
    expect(center.x).toBeCloseTo(0, 6);
    expect(center.y).toBeGreaterThan(0);
  });

  it('clears the owner, leaving at least the gap', () => {
    const center = centerOf(findFreeOffset(context()));
    const clearance = Math.abs(center.y) - OWNER.height / 2 - NEW.height / 2;
    expect(clearance).toBeGreaterThanOrEqual(24);
  });

  it('moves the second attribute somewhere else', () => {
    const first = findFreeOffset(context());
    const second = findFreeOffset(context([{ offset: first, size: NEW }]));
    expect(second).not.toEqual(first);
  });

  it('never overlaps an attribute that is already there', () => {
    let document: AttributeSlotContext['existing'] = [];
    const placed: { x: number; y: number }[] = [];

    for (let index = 0; index < 10; index += 1) {
      const offset = findFreeOffset(context(document));
      placed.push(centerOf(offset));
      document = [...document, { offset, size: NEW }];
    }

    for (let a = 0; a < placed.length; a += 1) {
      for (let b = a + 1; b < placed.length; b += 1) {
        const first = placed[a];
        const second = placed[b];
        if (!first || !second) continue;
        const apart =
          Math.abs(first.x - second.x) >= NEW.width || Math.abs(first.y - second.y) >= NEW.height;
        expect(apart).toBe(true);
      }
    }
  });

  it('is deterministic', () => {
    expect(findFreeOffset(context())).toEqual(findFreeOffset(context()));
  });

  it('still returns a position when every ring is full', () => {
    const crowded = Array.from({ length: 200 }, (_, index) => ({
      offset: { x: (index % 20) * 10 - 100, y: Math.floor(index / 20) * 10 - 100 },
      size: NEW,
    }));
    const offset = findFreeOffset(context(crowded), { maxRings: 1 });
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
  });

  it('honours a custom gap', () => {
    const tight = centerOf(findFreeOffset(context(), { gap: 0 }));
    const loose = centerOf(findFreeOffset(context(), { gap: 60 }));
    expect(Math.abs(loose.y)).toBeGreaterThan(Math.abs(tight.y));
  });
});

describe('attributeOffsetFor', () => {
  function sample(): ErDocument {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 0, y: 0 } });
    document = addEntity(document, { id: 'pub', name: 'PUBLISHER', position: { x: 400, y: 0 } });
    document = addRelationship(document, {
      id: 'rel',
      name: 'published_by',
      entityIds: ['book', 'pub'],
      position: { x: 200, y: 0 },
    });
    return document;
  }

  it('places an attribute on an entity', () => {
    const offset = attributeOffsetFor(sample(), 'book', 'isbn');
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
  });

  it('places an attribute on a relationship too', () => {
    expect(attributeOffsetFor(sample(), 'rel', 'since')).toBeDefined();
  });

  it('avoids the attributes already on the owner', () => {
    let document = sample();
    const first = attributeOffsetFor(document, 'book', 'isbn');
    document = addAttribute(document, {
      id: 'isbn',
      ownerId: 'book',
      name: 'isbn',
      offset: first,
    });
    expect(attributeOffsetFor(document, 'book', 'title')).not.toEqual(first);
  });

  it('sizes the owner from its name, so a long name pushes attributes further out', () => {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'a', name: 'A', position: { x: 0, y: 0 } });
    document = addEntity(document, {
      id: 'b',
      name: 'A_VERY_LONG_ENTITY_NAME_INDEED',
      position: { x: 0, y: 0 },
    });

    const narrow = shapeSizeFor('rect', 'A');
    const wide = shapeSizeFor('rect', 'A_VERY_LONG_ENTITY_NAME_INDEED');
    expect(wide.width).toBeGreaterThan(narrow.width);

    const offsetA = attributeOffsetFor(document, 'a', 'x');
    const offsetB = attributeOffsetFor(document, 'b', 'x');
    expect(offsetB.y).toBeGreaterThanOrEqual(offsetA.y);
  });

  it('rejects an unknown owner', () => {
    expect(() => attributeOffsetFor(sample(), 'ghost', 'x')).toThrow(ModelError);
  });

  it('places a part around a composite attribute', () => {
    let document = sample();
    document = addAttribute(document, {
      id: 'name',
      ownerId: 'book',
      name: 'name',
      shape: 'composite',
      offset: { x: 0, y: 0 },
    });

    const offset = attributeOffsetFor(document, 'name', 'first');

    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
  });

  it('sizes a composite owner as an ellipse, not a rectangle', () => {
    let document = sample();
    document = addAttribute(document, {
      id: 'name',
      ownerId: 'book',
      name: 'name',
      shape: 'composite',
      offset: { x: 0, y: 0 },
    });

    // An ellipse owner is shorter than an entity owner, so its parts sit closer.
    const aroundAttribute = attributeOffsetFor(document, 'name', 'first');
    const aroundEntity = attributeOffsetFor(document, 'book', 'isbn');
    expect(Math.abs(aroundAttribute.y)).toBeLessThan(Math.abs(aroundEntity.y));
  });

  it('copes with an owner that has no saved position', () => {
    let document = sample();
    document = addAttribute(document, {
      id: 'isbn',
      ownerId: 'book',
      name: 'isbn',
      offset: { x: 0, y: 0 },
    });
    const stripped: ErDocument = {
      ...document,
      layout: { positions: {} },
    };
    expect(() => attributeOffsetFor(stripped, 'book', 'title')).not.toThrow();
  });
});

describe('placeMissingPositions', () => {
  function bookstore(): ErDocument {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 100, y: 100 } });
    document = addEntity(document, { id: 'author', name: 'AUTHOR', position: { x: 500, y: 300 } });
    document = addRelationship(document, {
      id: 'writes',
      name: 'writes',
      entityIds: ['author', 'book'],
      position: { x: 300, y: 200 },
    });
    document = addAttribute(document, {
      id: 'isbn',
      ownerId: 'book',
      name: 'isbn',
      offset: { x: 0, y: 140 },
    });
    return document;
  }

  /** Removes positions, the way a hand-edited file might. */
  function without(document: ErDocument, ids: string[]): ErDocument {
    const dropped = new Set(ids);
    return {
      ...document,
      layout: {
        positions: Object.fromEntries(
          Object.entries(document.layout.positions).filter(([id]) => !dropped.has(id)),
        ),
      },
    };
  }

  it('does nothing when nothing is missing', () => {
    const document = bookstore();
    expect(placeMissingPositions(document, [])).toBe(document);
  });

  it('gives a missing entity a position', () => {
    const stripped = without(bookstore(), ['book']);
    const repaired = placeMissingPositions(stripped, ['book']);
    expect(repaired.layout.positions['book']).toBeDefined();
  });

  it('places a missing entity below everything already positioned', () => {
    const stripped = without(bookstore(), ['book']);
    const repaired = placeMissingPositions(stripped, ['book']);
    const placed = repaired.layout.positions['book'];
    expect(placed?.y).toBeGreaterThan(300);
  });

  it('never moves an element that already had a position', () => {
    const stripped = without(bookstore(), ['book']);
    const repaired = placeMissingPositions(stripped, ['book']);
    expect(repaired.layout.positions['author']).toEqual({ x: 500, y: 300 });
    expect(repaired.layout.positions['writes']).toEqual({ x: 300, y: 200 });
  });

  it('spreads several missing elements out instead of stacking them', () => {
    const stripped = without(bookstore(), ['book', 'author', 'writes']);
    const repaired = placeMissingPositions(stripped, ['book', 'author', 'writes']);
    const placed = ['book', 'author', 'writes'].map((id) =>
      JSON.stringify(repaired.layout.positions[id]),
    );
    expect(new Set(placed).size).toBe(3);
  });

  it('places a missing attribute around its owner', () => {
    const stripped = without(bookstore(), ['isbn']);
    const repaired = placeMissingPositions(stripped, ['isbn']);
    const offset = repaired.layout.positions['isbn'];
    expect(Number.isFinite(offset?.x)).toBe(true);
    expect(Number.isFinite(offset?.y)).toBe(true);
  });

  it('keeps two missing attributes on the same owner apart', () => {
    let document = addAttribute(bookstore(), {
      id: 'title',
      ownerId: 'book',
      name: 'title',
      offset: { x: 0, y: 0 },
    });
    document = without(document, ['isbn', 'title']);

    const repaired = placeMissingPositions(document, ['isbn', 'title']);
    expect(repaired.layout.positions['isbn']).not.toEqual(repaired.layout.positions['title']);
  });

  it('places an attribute whose owner was also missing', () => {
    const stripped = without(bookstore(), ['book', 'isbn']);
    const repaired = placeMissingPositions(stripped, ['book', 'isbn']);
    expect(repaired.layout.positions['book']).toBeDefined();
    expect(repaired.layout.positions['isbn']).toBeDefined();
  });

  it('copes with a document that has no positions at all', () => {
    const stripped = without(bookstore(), ['book', 'author', 'writes', 'isbn']);
    const repaired = placeMissingPositions(stripped, ['book', 'author', 'writes', 'isbn']);
    expect(Object.keys(repaired.layout.positions).sort()).toEqual([
      'author',
      'book',
      'isbn',
      'writes',
    ]);
  });

  it('never touches the model, only the layout', () => {
    const stripped = without(bookstore(), ['book']);
    expect(placeMissingPositions(stripped, ['book']).model).toEqual(stripped.model);
  });

  it('is deterministic', () => {
    const stripped = without(bookstore(), ['book', 'isbn']);
    expect(placeMissingPositions(stripped, ['book', 'isbn'])).toEqual(
      placeMissingPositions(stripped, ['book', 'isbn']),
    );
  });
});
