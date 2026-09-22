import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { CURRENT_VERSION, parseErDocument, parseErDocumentJson } from '../schema';
import type { erDocumentSchema } from '../schema';
import { createEmptyDocument } from '../operations';
import type { ErDocument } from '../types';
import { readFixture } from './readFixture';

/** The zod schema and the hand-written types must not drift apart. */
it('infers exactly the ErDocument type', () => {
  expectTypeOf<z.infer<typeof erDocumentSchema>>().toEqualTypeOf<ErDocument>();
});

/** Indexed fixture access that fails loudly instead of needing a non-null assertion. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`fixture has no element at index ${String(index)}`);
  }
  return item;
}

function valid(): unknown {
  return JSON.parse(readFixture('bookstore.erd.json')) as unknown;
}

/** Applies a mutation to a deep copy of the good fixture. */
function corrupted(mutate: (document: ErDocument) => void): unknown {
  const document = JSON.parse(readFixture('bookstore.erd.json')) as ErDocument;
  mutate(document);
  return document;
}

function expectRejected(input: unknown): string {
  const outcome = parseErDocument(input);
  expect(outcome.ok).toBe(false);
  if (outcome.ok) {
    throw new Error('expected the document to be rejected');
  }
  expect(outcome.message.length).toBeGreaterThan(0);
  return outcome.message;
}

describe('parseErDocument', () => {
  it('accepts an empty document', () => {
    const outcome = parseErDocument(createEmptyDocument());
    expect(outcome.ok).toBe(true);
  });

  it('accepts the bookstore fixture', () => {
    const outcome = parseErDocument(valid());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.model.entities).toHaveLength(4);
    expect(outcome.value.document.model.relationships).toHaveLength(3);
    expect(outcome.value.missingPositionIds).toEqual([]);
  });

  it('accepts the broken-by-design fixture, which is valid JSON but poor modelling', () => {
    const outcome = parseErDocument(JSON.parse(readFixture('bookstore-broken.erd.json')));
    expect(outcome.ok).toBe(true);
  });

  it('exposes the current version', () => {
    expect(CURRENT_VERSION).toBe(1);
  });
});

describe('parseErDocument rejects malformed files', () => {
  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', []],
    ['an empty object', {}],
  ])('rejects %s', (_label, input) => {
    expectRejected(input);
  });

  it('rejects an unknown future version with a specific message', () => {
    const message = expectRejected(
      corrupted((document) => Object.assign(document, { version: 2 })),
    );
    expect(message).toContain('2');
  });

  it('rejects a missing title', () => {
    expectRejected(
      corrupted((document) => {
        delete (document as Partial<ErDocument>).title;
      }),
    );
  });

  it('rejects unknown properties', () => {
    expectRejected(corrupted((document) => Object.assign(document, { extra: true })));
  });

  it('rejects an invalid cardinality', () => {
    expectRejected(
      corrupted((document) => {
        Object.assign(at(document.model.relationships, 0).ends[0], { cardinality: 'Z' });
      }),
    );
  });

  it('rejects a relationship that does not have exactly two ends', () => {
    expectRejected(
      corrupted((document) => {
        at(document.model.relationships, 0).ends.pop();
      }),
    );
  });

  it('rejects a non-finite position', () => {
    expectRejected(
      corrupted((document) => {
        document.layout.positions['ent_book'] = { x: Number.NaN, y: 0 };
      }),
    );
  });

  it('rejects a duplicate id', () => {
    const message = expectRejected(
      corrupted((document) => {
        at(document.model.entities, 1).id = at(document.model.entities, 0).id;
      }),
    );
    expect(message).toContain('ent_publisher');
  });

  it('rejects an attribute whose owner is missing', () => {
    const message = expectRejected(
      corrupted((document) => {
        at(document.model.attributes, 0).ownerId = 'ghost';
      }),
    );
    expect(message).toContain('name');
  });

  it('rejects an attribute whose ownerKind does not match its owner', () => {
    expectRejected(
      corrupted((document) => {
        at(document.model.attributes, 0).ownerKind = 'relationship';
      }),
    );
  });

  it('rejects a relationship end pointing at a missing entity', () => {
    const message = expectRejected(
      corrupted((document) => {
        at(document.model.relationships, 0).ends[1].entityId = 'ghost';
      }),
    );
    expect(message).toContain('published_by');
  });

  it('rejects a self-relationship, which is phase 2', () => {
    const message = expectRejected(
      corrupted((document) => {
        at(document.model.relationships, 0).ends[1].entityId = at(
          document.model.relationships,
          0,
        ).ends[0].entityId;
      }),
    );
    expect(message).toContain('published_by');
  });

  it('names an unnamed element rather than quoting an empty string', () => {
    const message = expectRejected(
      corrupted((document) => {
        at(document.model.attributes, 0).name = '   ';
        at(document.model.attributes, 0).ownerId = 'ghost';
      }),
    );
    expect(message).not.toContain('""');
  });
});

describe('parseErDocument checks relationship-owned attributes', () => {
  it('accepts an attribute correctly attached to a relationship', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const attribute = at(document.model.attributes, 0);
        attribute.ownerId = at(document.model.relationships, 0).id;
        attribute.ownerKind = 'relationship';
      }),
    );
    expect(outcome.ok).toBe(true);
  });

  it('rejects an attribute on a relationship that still claims an entity owner', () => {
    expectRejected(
      corrupted((document) => {
        at(document.model.attributes, 0).ownerId = at(document.model.relationships, 0).id;
      }),
    );
  });

  it('keeps a key attribute imported onto a relationship so the validator can flag it', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const attribute = at(document.model.attributes, 0);
        attribute.ownerId = at(document.model.relationships, 0).id;
        attribute.ownerKind = 'relationship';
        attribute.kind = 'key';
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.model.attributes.some((a) => a.kind === 'key')).toBe(true);
  });
});

describe('parseErDocument tolerates missing layout positions', () => {
  it('loads the document and reports the ids to place', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        delete document.layout.positions['ent_book'];
        delete document.layout.positions['attr_book_isbn'];
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.missingPositionIds.sort()).toEqual(['attr_book_isbn', 'ent_book']);
    expect(outcome.value.document.model.entities).toHaveLength(4);
  });

  it('ignores stray positions for elements that do not exist', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        document.layout.positions['ghost'] = { x: 1, y: 1 };
      }),
    );
    expect(outcome.ok).toBe(true);
  });
});

describe('parseErDocumentJson', () => {
  it('parses the fixture text', () => {
    expect(parseErDocumentJson(readFixture('bookstore.erd.json')).ok).toBe(true);
  });

  it('reports unreadable JSON separately from an invalid diagram', () => {
    const outcome = parseErDocumentJson('{ not json');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('JSON');
  });

  it('rejects valid JSON that is not a diagram', () => {
    expect(parseErDocumentJson('{"hello":"world"}').ok).toBe(false);
  });
});
