import { describe, expect, it } from 'vitest';
import { shapeSizeFor } from '../../geometry';
import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
} from '../../model/operations';
import type { ErDocument } from '../../model/types';
import { absoluteBoxes } from '../boxes';

function nested(): ErDocument {
  let document = createEmptyDocument();
  document = addEntity(document, { id: 'book', name: 'BOOK', position: { x: 1000, y: 500 } });
  document = addEntity(document, { id: 'author', name: 'AUTHOR', position: { x: 0, y: 0 } });
  document = addRelationship(document, {
    id: 'writes',
    name: 'writes',
    entityIds: ['author', 'book'],
    position: { x: 400, y: 200 },
  });
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

describe('absoluteBoxes', () => {
  it('places entities and relationships at their saved top-left corners', () => {
    const boxes = absoluteBoxes(nested());
    const size = shapeSizeFor('rect', 'BOOK');
    expect(boxes.get('book')?.center).toEqual({
      x: 1000 + size.width / 2,
      y: 500 + size.height / 2,
    });
    expect(boxes.get('writes')?.kind).toBe('diamond');
  });

  it('offsets an attribute from its owner', () => {
    const boxes = absoluteBoxes(nested());
    const size = shapeSizeFor('ellipse', 'name');
    expect(boxes.get('name')?.center).toEqual({
      x: 1100 + size.width / 2,
      y: 700 + size.height / 2,
    });
  });

  it('accumulates offsets down a composite chain', () => {
    const boxes = absoluteBoxes(nested());
    const size = shapeSizeFor('ellipse', 'first');
    expect(boxes.get('first')?.center).toEqual({
      x: 1130 + size.width / 2,
      y: 760 + size.height / 2,
    });
  });

  it('lists every owner before its parts, whatever order the model is in', () => {
    const document = nested();
    const reversed: ErDocument = {
      ...document,
      model: { ...document.model, attributes: [...document.model.attributes].reverse() },
    };
    const order = [...absoluteBoxes(reversed).keys()];
    expect(order.indexOf('book')).toBeLessThan(order.indexOf('name'));
    expect(order.indexOf('name')).toBeLessThan(order.indexOf('first'));
  });

  it('skips attributes whose owner cannot be placed', () => {
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
    const boxes = absoluteBoxes(orphaned);
    expect(boxes.has('name')).toBe(false);
    expect(boxes.has('first')).toBe(false);
  });

  it('puts an element with no saved position at the origin', () => {
    const document = nested();
    const stripped: ErDocument = { ...document, layout: { positions: {} } };
    const size = shapeSizeFor('rect', 'BOOK');
    expect(absoluteBoxes(stripped).get('book')?.center).toEqual({
      x: size.width / 2,
      y: size.height / 2,
    });
  });

  it('is empty for an empty diagram', () => {
    expect(absoluteBoxes(createEmptyDocument()).size).toBe(0);
  });
});
