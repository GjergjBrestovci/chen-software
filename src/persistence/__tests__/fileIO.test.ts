import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FILE_EXTENSION,
  fileNameFor,
  openDocumentText,
  placementNotice,
  serializeDocument,
} from '../fileIO';
import { createEmptyDocument } from '../../model/operations';
import type { ErDocument } from '../../model/types';

function fixture(name: string): string {
  return readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8');
}

describe('fileNameFor', () => {
  it('slugifies the diagram title', () => {
    expect(fileNameFor('Bookstore')).toBe(`bookstore${FILE_EXTENSION}`);
    expect(fileNameFor('My ER Diagram')).toBe(`my-er-diagram${FILE_EXTENSION}`);
  });

  it('strips characters a filesystem would object to', () => {
    expect(fileNameFor('a/b:c*?"<>|d')).toBe(`a-b-c-d${FILE_EXTENSION}`);
  });

  it('never produces a leading or trailing dash', () => {
    expect(fileNameFor('  !Bookstore!  ')).toBe(`bookstore${FILE_EXTENSION}`);
  });

  it('falls back when the title has nothing usable in it', () => {
    expect(fileNameFor('')).toBe(`diagram${FILE_EXTENSION}`);
    expect(fileNameFor('###')).toBe(`diagram${FILE_EXTENSION}`);
  });
});

describe('serializeDocument', () => {
  it('writes readable JSON ending in a newline', () => {
    const text = serializeDocument(createEmptyDocument('Bookstore'));
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "title": "Bookstore"');
  });

  it('round-trips exactly', () => {
    const document = JSON.parse(fixture('university.erd.json')) as ErDocument;
    const outcome = openDocumentText(serializeDocument(document));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document).toEqual(document);
  });
});

describe('openDocumentText', () => {
  it('opens a current file', () => {
    const outcome = openDocumentText(fixture('bookstore.erd.json'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.model.entities).toHaveLength(4);
    expect(outcome.value.placedIds).toEqual([]);
  });

  it('migrates an old file on the way in', () => {
    const outcome = openDocumentText(fixture('bookstore-v1.erd.json'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.version).toBe(2);
  });

  it('rejects unreadable JSON', () => {
    const outcome = openDocumentText('{ not json');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('JSON');
  });

  it('rejects a damaged diagram whole, loading nothing', () => {
    const damaged = JSON.parse(fixture('bookstore.erd.json')) as ErDocument;
    const attribute = damaged.model.attributes[0];
    if (attribute) {
      attribute.ownerId = 'ghost';
    }
    expect(openDocumentText(JSON.stringify(damaged)).ok).toBe(false);
  });

  it('places elements that arrive without a position, rather than refusing', () => {
    const document = JSON.parse(fixture('bookstore.erd.json')) as ErDocument;
    delete document.layout.positions['ent_book'];
    delete document.layout.positions['attr_book_isbn'];

    const outcome = openDocumentText(JSON.stringify(document));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.value.placedIds.sort()).toEqual(['attr_book_isbn', 'ent_book']);
    expect(outcome.value.document.layout.positions['ent_book']).toBeDefined();
    expect(outcome.value.document.layout.positions['attr_book_isbn']).toBeDefined();
    // Nothing else moved.
    expect(outcome.value.document.layout.positions['ent_author']).toEqual(
      document.layout.positions['ent_author'],
    );
  });

  it('keeps every element when a file has no positions at all', () => {
    const document = JSON.parse(fixture('university.erd.json')) as ErDocument;
    const elementCount =
      document.model.entities.length +
      document.model.relationships.length +
      document.model.attributes.length;
    document.layout.positions = {};

    const outcome = openDocumentText(JSON.stringify(document));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.value.placedIds).toHaveLength(elementCount);
    expect(Object.keys(outcome.value.document.layout.positions)).toHaveLength(elementCount);
    expect(outcome.value.document.model).toEqual(document.model);
  });
});

describe('placementNotice', () => {
  it('says nothing when nothing needed placing', () => {
    expect(placementNotice([])).toBeNull();
  });

  it('counts what it placed', () => {
    expect(placementNotice(['a'])).toContain('One');
    expect(placementNotice(['a', 'b'])).toContain('2');
  });
});
