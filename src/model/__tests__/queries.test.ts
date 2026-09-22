import { describe, expect, it } from 'vitest';
import { addAttribute, addEntity, addRelationship, createEmptyDocument } from '../operations';
import {
  allElementIds,
  isDescendantOf,
  rootOwnerOf,
  attributesOf,
  findAttribute,
  findElementKind,
  findElementName,
  findEntity,
  findRelationship,
  relationshipsTouching,
} from '../queries';
import type { ErDocument, ErModel } from '../types';

const origin = { x: 0, y: 0 };

function sample(): ErDocument {
  let document = createEmptyDocument('Sample');
  document = addEntity(document, { id: 'a', name: 'AUTHOR', position: origin });
  document = addEntity(document, { id: 'b', name: 'BOOK', position: origin });
  document = addEntity(document, { id: 'c', name: 'GENRE', position: origin });
  document = addRelationship(document, {
    id: 'r',
    name: 'writes',
    entityIds: ['a', 'b'],
    position: origin,
  });
  document = addAttribute(document, { id: 'at1', ownerId: 'a', name: 'name', offset: origin });
  document = addAttribute(document, { id: 'at2', ownerId: 'a', name: 'born', offset: origin });
  document = addAttribute(document, { id: 'at3', ownerId: 'r', name: 'share', offset: origin });
  return document;
}

describe('queries', () => {
  const { model } = sample();

  it('finds each kind of element', () => {
    expect(findEntity(model, 'a')?.name).toBe('AUTHOR');
    expect(findRelationship(model, 'r')?.name).toBe('writes');
    expect(findAttribute(model, 'at1')?.name).toBe('name');
  });

  it('returns undefined for unknown ids', () => {
    expect(findEntity(model, 'nope')).toBeUndefined();
    expect(findRelationship(model, 'nope')).toBeUndefined();
    expect(findAttribute(model, 'nope')).toBeUndefined();
  });

  it('classifies ids', () => {
    expect(findElementKind(model, 'a')).toBe('entity');
    expect(findElementKind(model, 'r')).toBe('relationship');
    expect(findElementKind(model, 'at1')).toBe('attribute');
    expect(findElementKind(model, 'nope')).toBeUndefined();
  });

  it('lists the attributes of an owner in model order', () => {
    expect(attributesOf(model, 'a').map((attribute) => attribute.name)).toEqual(['name', 'born']);
    expect(attributesOf(model, 'r').map((attribute) => attribute.name)).toEqual(['share']);
    expect(attributesOf(model, 'c')).toEqual([]);
  });

  it('finds relationships touching an entity from either end', () => {
    expect(relationshipsTouching(model, 'a').map((r) => r.id)).toEqual(['r']);
    expect(relationshipsTouching(model, 'b').map((r) => r.id)).toEqual(['r']);
    expect(relationshipsTouching(model, 'c')).toEqual([]);
  });

  it('collects every element id', () => {
    expect(allElementIds(model).sort()).toEqual(['a', 'at1', 'at2', 'at3', 'b', 'c', 'r']);
  });
});

describe('findElementName', () => {
  const { model } = sample();

  it('names an entity, a relationship and an attribute alike', () => {
    expect(findElementName(model, 'a')).toBe('AUTHOR');
    expect(findElementName(model, 'r')).toBe('writes');
    expect(findElementName(model, 'at3')).toBe('share');
  });

  it('has no name for an unknown id', () => {
    expect(findElementName(model, 'ghost')).toBeUndefined();
  });
});

describe('composite ancestry', () => {
  /** BOOK ← name(composite) ← first, so `first` is two levels down. */
  function nested(): ErDocument {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'book', name: 'BOOK', position: origin });
    document = addAttribute(document, {
      id: 'name',
      ownerId: 'book',
      name: 'name',
      shape: 'composite',
      offset: origin,
    });
    document = addAttribute(document, {
      id: 'first',
      ownerId: 'name',
      name: 'first',
      offset: origin,
    });
    return document;
  }

  it('walks a part up to the entity that owns it', () => {
    expect(rootOwnerOf(nested().model, 'first')?.id).toBe('book');
    expect(rootOwnerOf(nested().model, 'name')?.id).toBe('book');
  });

  it('walks up to a relationship owner too', () => {
    const { model } = sample();
    expect(rootOwnerOf(model, 'at3')?.id).toBe('r');
  });

  it('has no root owner for an unknown attribute', () => {
    expect(rootOwnerOf(nested().model, 'ghost')).toBeUndefined();
  });

  it('gives up rather than looping on a cyclic model', () => {
    const document = nested();
    const cyclic: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name'
          ? { ...attribute, ownerId: 'first', ownerKind: 'attribute' as const }
          : attribute,
      ),
    };
    expect(rootOwnerOf(cyclic, 'first')).toBeUndefined();
  });

  it('has no root owner when the chain is broken', () => {
    const document = nested();
    const broken: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name' ? { ...attribute, ownerId: 'ghost' } : attribute,
      ),
    };
    expect(rootOwnerOf(broken, 'first')).toBeUndefined();
  });

  it('recognises descendants at any depth', () => {
    const { model } = nested();
    expect(isDescendantOf(model, 'first', 'name')).toBe(true);
    expect(isDescendantOf(model, 'first', 'book')).toBe(true);
    expect(isDescendantOf(model, 'name', 'first')).toBe(false);
    expect(isDescendantOf(model, 'ghost', 'book')).toBe(false);
  });

  it('terminates on a cycle instead of hanging', () => {
    const document = nested();
    const cyclic: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name'
          ? { ...attribute, ownerId: 'first', ownerKind: 'attribute' as const }
          : attribute,
      ),
    };
    expect(isDescendantOf(cyclic, 'first', 'book')).toBe(false);
  });
});
