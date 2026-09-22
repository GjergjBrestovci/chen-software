import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { createEmptyDocument } from '../../model/operations';
import { findAttribute, findEntity, findRelationship } from '../../model/queries';
import { useDocumentStore } from '../documentStore';

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
    const id = store().addRelationshipBetween(a, b, { x: 200, y: 0 });

    expect(findRelationship(store().document.model, id)?.ends).toEqual([
      { entityId: a, cardinality: null },
      { entityId: b, cardinality: null },
    ]);
  });

  it('cycles a cardinality through 1, N, M', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    const id = store().addRelationshipBetween(a, b, { x: 200, y: 0 });
    const valueAt = (): string | null =>
      findRelationship(store().document.model, id)?.ends[0].cardinality ?? null;

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
    const id = store().addRelationshipBetween(a, b, { x: 200, y: 0 });
    store().setCardinality(id, 1, 'M');
    store().setCardinality(id, 1, null);
    expect(findRelationship(store().document.model, id)?.ends[1].cardinality).toBeNull();
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
    store().addRelationshipBetween(a, b, { x: 200, y: 0 });
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
    store().addRelationshipBetween(a, b, { x: 200, y: 0 });
    store().addAttributeTo(a);
    const before = pastLength();

    store().remove([a]);

    expect(pastLength()).toBe(before + 1);
  });

  it('restores the whole cascade on undo', () => {
    const a = store().addEntityAt({ x: 0, y: 0 });
    const b = store().addEntityAt({ x: 400, y: 0 });
    store().addRelationshipBetween(a, b, { x: 200, y: 0 });
    store().remove([a]);

    useDocumentStore.temporal.getState().undo();

    expect(store().document.model.entities).toHaveLength(2);
    expect(store().document.model.relationships).toHaveLength(1);
  });
});
