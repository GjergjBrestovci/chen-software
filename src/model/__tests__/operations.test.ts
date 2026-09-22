import { describe, expect, it } from 'vitest';
import { ModelError } from '../errors';
import { dismissalKey } from '../dismissals';
import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
  deleteElements,
  moveElements,
  orphanedPositionIds,
  renameElement,
  setAttributeKind,
  setCardinality,
  setTitle,
} from '../operations';
import { attributesOf, findAttribute, findEntity, findRelationship } from '../queries';
import type { ErDocument } from '../types';

const origin = { x: 0, y: 0 };

/**
 * PUBLISHER -1- published_by -N- BOOK, plus an attribute on each element and
 * one attribute on the relationship.
 */
function sample(): ErDocument {
  let document = createEmptyDocument('Sample');
  document = addEntity(document, { id: 'pub', name: 'PUBLISHER', position: { x: 10, y: 20 } });
  document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 300, y: 20 } });
  document = addRelationship(document, {
    id: 'rel',
    name: 'published_by',
    entityIds: ['pub', 'book'],
    position: { x: 150, y: 20 },
  });
  document = addAttribute(document, {
    id: 'pubName',
    ownerId: 'pub',
    name: 'name',
    kind: 'key',
    offset: { x: -40, y: -60 },
  });
  document = addAttribute(document, {
    id: 'bookIsbn',
    ownerId: 'book',
    name: 'isbn',
    kind: 'key',
    offset: { x: 40, y: -60 },
  });
  document = addAttribute(document, {
    id: 'relSince',
    ownerId: 'rel',
    name: 'since',
    offset: { x: 0, y: 60 },
  });
  return document;
}

describe('createEmptyDocument', () => {
  it('starts at version 1 with nothing in it', () => {
    const document = createEmptyDocument();
    expect(document.version).toBe(1);
    expect(document.model).toEqual({ entities: [], attributes: [], relationships: [] });
    expect(document.layout.positions).toEqual({});
    expect(document.dismissedHints).toEqual([]);
  });

  it('accepts a title', () => {
    expect(createEmptyDocument('Bookstore').title).toBe('Bookstore');
  });

  it('defaults to a localised untitled name', () => {
    expect(createEmptyDocument().title.length).toBeGreaterThan(0);
  });
});

describe('addEntity', () => {
  it('adds the entity and records its absolute position', () => {
    const document = addEntity(createEmptyDocument(), {
      id: 'e1',
      name: 'BOOK',
      position: { x: 5, y: 7 },
    });
    expect(findEntity(document.model, 'e1')).toEqual({ id: 'e1', name: 'BOOK' });
    expect(document.layout.positions['e1']).toEqual({ x: 5, y: 7 });
  });

  it('allows an empty name, which the validator flags later', () => {
    const document = addEntity(createEmptyDocument(), { id: 'e1', name: '', position: origin });
    expect(findEntity(document.model, 'e1')?.name).toBe('');
  });

  it('rejects an id that is already in use', () => {
    const document = sample();
    expect(() => addEntity(document, { id: 'book', name: 'X', position: origin })).toThrow(
      ModelError,
    );
  });

  it('does not mutate the input document', () => {
    const before = createEmptyDocument();
    const snapshot = structuredClone(before);
    addEntity(before, { id: 'e1', name: 'BOOK', position: origin });
    expect(before).toEqual(snapshot);
  });
});

describe('addRelationship', () => {
  it('creates both ends with no cardinality chosen yet', () => {
    const relationship = findRelationship(sample().model, 'rel');
    expect(relationship?.ends).toEqual([
      { entityId: 'pub', cardinality: null },
      { entityId: 'book', cardinality: null },
    ]);
  });

  it('rejects an unknown entity', () => {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'a', name: 'A', position: origin });
    expect(() =>
      addRelationship(document, {
        id: 'r',
        name: 'x',
        entityIds: ['a', 'ghost'],
        position: origin,
      }),
    ).toThrow(ModelError);
  });

  it('rejects a self-relationship, which is phase 2', () => {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'a', name: 'A', position: origin });
    expect(() =>
      addRelationship(document, { id: 'r', name: 'x', entityIds: ['a', 'a'], position: origin }),
    ).toThrow(ModelError);
  });

  it('rejects a duplicate id', () => {
    expect(() =>
      addRelationship(sample(), {
        id: 'pub',
        name: 'x',
        entityIds: ['pub', 'book'],
        position: origin,
      }),
    ).toThrow(ModelError);
  });
});

describe('addAttribute', () => {
  it('derives ownerKind from the owner', () => {
    const { model } = sample();
    expect(findAttribute(model, 'pubName')?.ownerKind).toBe('entity');
    expect(findAttribute(model, 'relSince')?.ownerKind).toBe('relationship');
  });

  it('defaults to a simple attribute', () => {
    expect(findAttribute(sample().model, 'relSince')?.kind).toBe('simple');
  });

  it('stores the offset relative to the owner', () => {
    expect(sample().layout.positions['pubName']).toEqual({ x: -40, y: -60 });
  });

  it('rejects an unknown owner', () => {
    expect(() =>
      addAttribute(sample(), { id: 'x', ownerId: 'ghost', name: 'a', offset: origin }),
    ).toThrow(ModelError);
  });

  it('rejects a key attribute on a relationship', () => {
    expect(() =>
      addAttribute(sample(), {
        id: 'x',
        ownerId: 'rel',
        name: 'a',
        kind: 'key',
        offset: origin,
      }),
    ).toThrow(ModelError);
  });

  it('rejects a duplicate id', () => {
    expect(() =>
      addAttribute(sample(), { id: 'book', ownerId: 'book', name: 'a', offset: origin }),
    ).toThrow(ModelError);
  });
});

describe('renameElement', () => {
  it('renames each kind of element', () => {
    let document = sample();
    document = renameElement(document, { id: 'book', name: 'VOLUME' });
    document = renameElement(document, { id: 'rel', name: 'issued_by' });
    document = renameElement(document, { id: 'bookIsbn', name: 'ean' });
    expect(findEntity(document.model, 'book')?.name).toBe('VOLUME');
    expect(findRelationship(document.model, 'rel')?.name).toBe('issued_by');
    expect(findAttribute(document.model, 'bookIsbn')?.name).toBe('ean');
  });

  it('allows clearing a name', () => {
    const document = renameElement(sample(), { id: 'book', name: '' });
    expect(findEntity(document.model, 'book')?.name).toBe('');
  });

  it('rejects an unknown element', () => {
    expect(() => renameElement(sample(), { id: 'ghost', name: 'x' })).toThrow(ModelError);
  });
});

describe('setAttributeKind', () => {
  it('promotes and demotes an entity attribute', () => {
    let document = setAttributeKind(sample(), { id: 'pubName', kind: 'simple' });
    expect(findAttribute(document.model, 'pubName')?.kind).toBe('simple');
    document = setAttributeKind(document, { id: 'pubName', kind: 'key' });
    expect(findAttribute(document.model, 'pubName')?.kind).toBe('key');
  });

  it('refuses to mark a relationship attribute as key', () => {
    expect(() => setAttributeKind(sample(), { id: 'relSince', kind: 'key' })).toThrow(ModelError);
  });

  it('still allows demoting a relationship attribute', () => {
    const document = setAttributeKind(sample(), { id: 'relSince', kind: 'simple' });
    expect(findAttribute(document.model, 'relSince')?.kind).toBe('simple');
  });

  it('rejects an unknown attribute', () => {
    expect(() => setAttributeKind(sample(), { id: 'ghost', kind: 'key' })).toThrow(ModelError);
  });
});

describe('setCardinality', () => {
  it('sets each end independently', () => {
    let document = setCardinality(sample(), {
      relationshipId: 'rel',
      endIndex: 0,
      cardinality: '1',
    });
    document = setCardinality(document, {
      relationshipId: 'rel',
      endIndex: 1,
      cardinality: 'N',
    });
    expect(findRelationship(document.model, 'rel')?.ends).toEqual([
      { entityId: 'pub', cardinality: '1' },
      { entityId: 'book', cardinality: 'N' },
    ]);
  });

  it('clears a cardinality back to undecided', () => {
    let document = setCardinality(sample(), {
      relationshipId: 'rel',
      endIndex: 0,
      cardinality: 'M',
    });
    document = setCardinality(document, {
      relationshipId: 'rel',
      endIndex: 0,
      cardinality: null,
    });
    expect(findRelationship(document.model, 'rel')?.ends[0].cardinality).toBeNull();
  });

  it('rejects an unknown relationship', () => {
    expect(() =>
      setCardinality(sample(), { relationshipId: 'ghost', endIndex: 0, cardinality: '1' }),
    ).toThrow(ModelError);
  });
});

describe('moveElements', () => {
  it('moves several elements in one call, so a drag is one undo entry', () => {
    const document = moveElements(sample(), [
      { id: 'book', position: { x: 999, y: 111 } },
      { id: 'bookIsbn', position: { x: -10, y: -10 } },
    ]);
    expect(document.layout.positions['book']).toEqual({ x: 999, y: 111 });
    expect(document.layout.positions['bookIsbn']).toEqual({ x: -10, y: -10 });
  });

  it('leaves the model untouched, so layout cannot change correctness', () => {
    const before = sample();
    const after = moveElements(before, [{ id: 'book', position: { x: 42, y: 42 } }]);
    expect(after.model).toEqual(before.model);
  });

  it('rejects an unknown element and applies nothing', () => {
    const before = sample();
    expect(() =>
      moveElements(before, [
        { id: 'book', position: { x: 1, y: 1 } },
        { id: 'ghost', position: { x: 2, y: 2 } },
      ]),
    ).toThrow(ModelError);
    expect(before.layout.positions['book']).toEqual({ x: 300, y: 20 });
  });
});

describe('setTitle', () => {
  it('replaces the title', () => {
    expect(setTitle(sample(), 'Bookstore').title).toBe('Bookstore');
  });
});

describe('deleteElements', () => {
  it('deletes a lone attribute', () => {
    const document = deleteElements(sample(), ['relSince']);
    expect(findAttribute(document.model, 'relSince')).toBeUndefined();
    expect(findRelationship(document.model, 'rel')).toBeDefined();
    expect(document.layout.positions['relSince']).toBeUndefined();
  });

  it('deletes a relationship together with its attributes', () => {
    const document = deleteElements(sample(), ['rel']);
    expect(findRelationship(document.model, 'rel')).toBeUndefined();
    expect(findAttribute(document.model, 'relSince')).toBeUndefined();
    expect(findEntity(document.model, 'pub')).toBeDefined();
    expect(findEntity(document.model, 'book')).toBeDefined();
  });

  it('cascades an entity to its attributes, its relationships and their attributes', () => {
    const document = deleteElements(sample(), ['pub']);
    expect(document.model.entities.map((entity) => entity.id)).toEqual(['book']);
    expect(document.model.relationships).toEqual([]);
    expect(document.model.attributes.map((attribute) => attribute.id)).toEqual(['bookIsbn']);
    expect(Object.keys(document.layout.positions).sort()).toEqual(['book', 'bookIsbn']);
  });

  it('cascades in one call, so it is a single undo entry', () => {
    const before = sample();
    const after = deleteElements(before, ['pub']);
    expect(before.model.entities).toHaveLength(2);
    expect(after.model.entities).toHaveLength(1);
  });

  it('handles a mixed multi-selection', () => {
    const document = deleteElements(sample(), ['bookIsbn', 'rel']);
    expect(document.model.attributes.map((attribute) => attribute.id)).toEqual(['pubName']);
    expect(document.model.relationships).toEqual([]);
    expect(document.model.entities).toHaveLength(2);
  });

  it('is a no-op for ids that are already gone', () => {
    const document = sample();
    expect(deleteElements(document, ['ghost'])).toBe(document);
    expect(deleteElements(document, [])).toBe(document);
  });

  it('ignores unknown ids mixed into a real selection', () => {
    const document = deleteElements(sample(), ['ghost', 'relSince']);
    expect(findAttribute(document.model, 'relSince')).toBeUndefined();
  });

  it('drops dismissals that point at deleted elements', () => {
    const document = sample();
    const withDismissals: ErDocument = {
      ...document,
      dismissedHints: [
        dismissalKey('isolated-entity', ['book']),
        dismissalKey('duplicate-entity-name', ['pub', 'book']),
        dismissalKey('isolated-entity', ['pub']),
      ],
    };
    const after = deleteElements(withDismissals, ['book']);
    expect(after.dismissedHints).toEqual([dismissalKey('isolated-entity', ['pub'])]);
  });

  it('leaves keys it cannot parse alone rather than discarding them', () => {
    const document = sample();
    const withJunk: ErDocument = { ...document, dismissedHints: ['not-a-key'] };
    expect(deleteElements(withJunk, ['relSince']).dismissedHints).toEqual(['not-a-key']);
  });

  it('does not mutate the input document', () => {
    const before = sample();
    const snapshot = structuredClone(before);
    deleteElements(before, ['pub']);
    expect(before).toEqual(snapshot);
  });

  it('removes the attributes of a deleted owner from attributesOf', () => {
    const document = deleteElements(sample(), ['rel']);
    expect(attributesOf(document.model, 'rel')).toEqual([]);
  });
});

describe('orphanedPositionIds', () => {
  it('finds nothing in a consistent document', () => {
    expect(orphanedPositionIds(sample())).toEqual([]);
  });

  it('reports positions with no matching element', () => {
    const document = sample();
    const withStray: ErDocument = {
      ...document,
      layout: { positions: { ...document.layout.positions, ghost: { x: 0, y: 0 } } },
    };
    expect(orphanedPositionIds(withStray)).toEqual(['ghost']);
  });
});
