import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { createEmptyDocument } from '../../model/operations';
import { findAttribute, findEntity, findRelationship } from '../../model/queries';
import { loadDocument, useDocumentStore } from '../documentStore';

function reset(): void {
  useDocumentStore.setState({ document: createEmptyDocument() });
  useDocumentStore.temporal.getState().clear();
}

const store = (): ReturnType<typeof useDocumentStore.getState> => useDocumentStore.getState();
const pastLength = (): number => useDocumentStore.temporal.getState().pastStates.length;

describe('documentStore', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('x'));
    reset();
  });

  afterEach(() => {
    resetIdGenerator();
  });

  it('adds an entity and returns its id', () => {
    const id = store().addEntityAt({ x: 10, y: 20 });
    expect(findEntity(store().document.model, id)?.name).toBe('');
    expect(store().document.layout.positions[id]).toEqual({ x: 10, y: 20 });
  });

  it('creates new elements unnamed, for the validator to flag', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    expect(findEntity(store().document.model, id)?.name).toBe('');
  });

  it('places a new attribute automatically without touching the model elsewhere', () => {
    const owner = store().addEntityAt({ x: 0, y: 0 });
    const before = store().document.model.entities;
    const attributeId = store().addAttributeTo(owner);

    expect(findAttribute(store().document.model, attributeId)?.ownerId).toBe(owner);
    expect(store().document.layout.positions[attributeId]).toBeDefined();
    expect(store().document.model.entities).toEqual(before);
  });

  it('creates a relationship with both cardinalities undecided', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween([a, b], { x: 200, y: 0 });

    expect(findRelationship(store().document.model, id)?.ends).toEqual([
      { entityId: a, cardinality: null, participation: 'partial', role: null },
      { entityId: b, cardinality: null, participation: 'partial', role: null },
    ]);
  });

  it('cycles a cardinality through 1, N, M', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    const valueAt = (): string | null =>
      findRelationship(store().document.model, id)?.ends[0]?.cardinality ?? null;

    store().cycleCardinality(id, 0);
    expect(valueAt()).toBe('1');
    store().cycleCardinality(id, 0);
    expect(valueAt()).toBe('N');
    store().cycleCardinality(id, 0);
    expect(valueAt()).toBe('M');
    store().cycleCardinality(id, 0);
    expect(valueAt()).toBe('1');
  });

  it('can clear a cardinality, which only the Inspector offers', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    store().setCardinality(id, 1, 'M');
    store().setCardinality(id, 1, null);
    expect(findRelationship(store().document.model, id)?.ends[1]?.cardinality).toBeNull();
  });

  it('ignores cycling on a relationship that is gone', () => {
    expect(() => {
      store().cycleCardinality('ghost', 0);
    }).not.toThrow();
  });

  it('renames an element', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    store().rename(id, 'BOOK');
    expect(findEntity(store().document.model, id)?.name).toBe('BOOK');
  });

  it('cascades a delete through relationships and attributes', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    store().addAttributeTo(a);

    store().remove([a]);

    expect(store().document.model.entities.map((entity) => entity.id)).toEqual([b]);
    expect(store().document.model.relationships).toEqual([]);
    expect(store().document.model.attributes).toEqual([]);
  });
});

describe('documentStore undo history', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('h'));
    reset();
  });

  afterEach(() => {
    resetIdGenerator();
  });

  it('records one entry per user action', () => {
    store().addEntityAt({ x: 0, y: 0 });
    expect(pastLength()).toBe(1);
    store().addEntityAt({ x: 100, y: 0 });
    expect(pastLength()).toBe(2);
  });

  it('records one entry for a whole drag, however many elements moved', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 100, y: 0 });
    const before = pastLength();

    store().moveMany([
      { id: a, position: { x: 40, y: 40 } },
      { id: b, position: { x: 140, y: 40 } },
    ]);

    expect(pastLength()).toBe(before + 1);
  });

  it('records nothing for a drag that moved nothing', () => {
    store().addEntityAt({ x: 0, y: 0 });
    const before = pastLength();
    store().moveMany([]);
    expect(pastLength()).toBe(before);
  });

  it('records one entry for a cascading delete', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    store().addAttributeTo(a);
    const before = pastLength();

    store().remove([a]);

    expect(pastLength()).toBe(before + 1);
  });

  it('restores the whole cascade on undo', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    store().remove([a]);

    useDocumentStore.temporal.getState().undo();

    expect(store().document.model.entities).toHaveLength(2);
    expect(store().document.model.relationships).toHaveLength(1);
  });
});

describe('documentStore undo and redo', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('u'));
    reset();
  });

  afterEach(() => {
    resetIdGenerator();
  });

  const temporal = (): ReturnType<typeof useDocumentStore.temporal.getState> =>
    useDocumentStore.temporal.getState();

  it('walks back one action at a time', () => {
    store().addEntityAt({ x: 0, y: 0 });
    store().addEntityAt({ x: 100, y: 0 });
    expect(store().document.model.entities).toHaveLength(2);

    temporal().undo();
    expect(store().document.model.entities).toHaveLength(1);
    temporal().undo();
    expect(store().document.model.entities).toHaveLength(0);
  });

  it('redoes what it undid', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    store().rename(id, 'BOOK');

    temporal().undo();
    expect(findEntity(store().document.model, id)?.name).toBe('');
    temporal().redo();
    expect(findEntity(store().document.model, id)?.name).toBe('BOOK');
  });

  it('restores positions, because layout is part of the document', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    store().moveMany([{ id, position: { x: 500, y: 500 } }]);

    temporal().undo();

    expect(store().document.layout.positions[id]).toEqual({ x: 0, y: 0 });
  });

  it('drops the redo branch once a new action is taken', () => {
    store().addEntityAt({ x: 0, y: 0 });
    store().addEntityAt({ x: 100, y: 0 });
    temporal().undo();
    expect(temporal().futureStates).toHaveLength(1);

    store().addEntityAt({ x: 200, y: 0 });

    expect(temporal().futureStates).toHaveLength(0);
  });

  it('does nothing when there is nothing to undo', () => {
    expect(() => {
      temporal().undo();
    }).not.toThrow();
    expect(store().document.model.entities).toHaveLength(0);
  });

  it('records nothing when a rename confirms the same name', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    store().rename(id, 'BOOK');
    const before = pastLength();

    store().rename(id, 'BOOK');

    expect(pastLength()).toBe(before);
  });

  it('ignores a rename of an element that undo has already removed', () => {
    const id = store().addEntityAt({ x: 0, y: 0 });
    temporal().undo();

    expect(() => {
      store().rename(id, 'BOOK');
    }).not.toThrow();
    expect(store().document.model.entities).toHaveLength(0);
  });

  it('records nothing for a drag that ends where it started', () => {
    const id = store().addEntityAt({ x: 40, y: 60 });
    const before = pastLength();

    store().moveMany([{ id, position: { x: 40, y: 60 } }]);

    expect(pastLength()).toBe(before);
  });

  it('records a drag that moved only one of several elements', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 100, y: 0 });
    const before = pastLength();

    store().moveMany([
      { id: a, position: { x: 0, y: 0 } },
      { id: b, position: { x: 180, y: 0 } },
    ]);

    expect(pastLength()).toBe(before + 1);
    expect(store().document.layout.positions[b]).toEqual({ x: 180, y: 0 });
  });

  it('records nothing when a cardinality is set to the value it already has', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    store().setCardinality(id, 0, 'N');
    const before = pastLength();

    store().setCardinality(id, 0, 'N');

    expect(pastLength()).toBe(before);
  });

  it('keeps one entry per cardinality click', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween([a, b], { x: 200, y: 0 });
    const before = pastLength();

    store().cycleCardinality(id, 0);
    store().cycleCardinality(id, 0);

    expect(pastLength()).toBe(before + 2);
  });
});

describe('loadDocument', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('l'));
    reset();
  });

  afterEach(() => {
    resetIdGenerator();
  });

  it('opens a different diagram and ends the old timeline', () => {
    store().addEntityAt({ x: 0, y: 0 });
    expect(pastLength()).toBeGreaterThan(0);

    loadDocument(createEmptyDocument('Imported'));

    expect(store().document.title).toBe('Imported');
    expect(pastLength()).toBe(0);
    expect(useDocumentStore.temporal.getState().futureStates).toHaveLength(0);
  });
});
