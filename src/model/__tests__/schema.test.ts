import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { CURRENT_VERSION, parseErDocument } from '../schema';
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
    expect(CURRENT_VERSION).toBe(2);
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
      corrupted((document) => Object.assign(document, { version: 9 })),
    );
    expect(message).toContain('9');
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
        Object.assign(at(at(document.model.relationships, 0).ends, 0), { cardinality: 'Z' });
      }),
    );
  });

  it('rejects a relationship with fewer than two ends', () => {
    expectRejected(
      corrupted((document) => {
        at(document.model.relationships, 0).ends.pop();
      }),
    );
  });

  it('accepts a ternary relationship', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const relationship = at(document.model.relationships, 0);
        relationship.ends.push({
          entityId: at(document.model.entities, 2).id,
          cardinality: '1',
          participation: 'partial',
          role: null,
        });
      }),
    );
    expect(outcome.ok).toBe(true);
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
        at(at(document.model.relationships, 0).ends, 1).entityId = 'ghost';
      }),
    );
    expect(message).toContain('published_by');
  });

  it('accepts a self-relationship, which version 2 supports', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const ends = at(document.model.relationships, 0).ends;
        const first = ends[0];
        const second = ends[1];
        if (first && second) {
          second.entityId = first.entityId;
        }
      }),
    );
    expect(outcome.ok).toBe(true);
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

describe('parseErDocument checks colours and composites', () => {
  it('accepts the university fixture, which uses every notation feature', () => {
    const outcome = parseErDocument(JSON.parse(readFixture('university.erd.json')));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.model.relationships.some((r) => r.ends.length === 3)).toBe(true);
    expect(outcome.value.document.model.attributes.some((a) => a.shape === 'composite')).toBe(true);
    expect(outcome.value.document.model.attributes.some((a) => a.foreignKey)).toBe(true);
    expect(Object.keys(outcome.value.document.presentation.colors)).toHaveLength(2);
  });

  it('rejects a colour that is not #rrggbb', () => {
    for (const bad of ['red', '#fff', '#12345g', '']) {
      expectRejected(
        corrupted((document) => {
          document.presentation.colors['ent_book'] = bad;
        }),
      );
    }
  });

  it('rejects a theme with a bad colour', () => {
    expectRejected(
      corrupted((document) => {
        document.presentation.theme.entity = 'blue';
      }),
    );
  });

  it('rejects a missing presentation slice', () => {
    expectRejected(
      corrupted((document) => {
        delete (document as Partial<ErDocument>).presentation;
      }),
    );
  });

  it('rejects an attribute that is part of itself', () => {
    const message = expectRejected(
      corrupted((document) => {
        const attribute = at(document.model.attributes, 0);
        attribute.ownerId = attribute.id;
        attribute.ownerKind = 'attribute';
      }),
    );
    expect(message).toContain('itself');
  });

  it('rejects a cycle between two composite attributes', () => {
    expectRejected(
      corrupted((document) => {
        const first = at(document.model.attributes, 0);
        const second = at(document.model.attributes, 1);
        first.ownerId = second.id;
        first.ownerKind = 'attribute';
        second.ownerId = first.id;
        second.ownerKind = 'attribute';
      }),
    );
  });

  it('accepts a legitimate composite chain', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const parent = at(document.model.attributes, 0);
        const child = at(document.model.attributes, 1);
        parent.shape = 'composite';
        child.ownerId = parent.id;
        child.ownerKind = 'attribute';
        child.identifier = 'none';
      }),
    );
    expect(outcome.ok).toBe(true);
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

  it('keeps a key attribute imported onto a relationship so the checks can flag it', () => {
    const outcome = parseErDocument(
      corrupted((document) => {
        const attribute = at(document.model.attributes, 0);
        attribute.ownerId = at(document.model.relationships, 0).id;
        attribute.ownerKind = 'relationship';
        attribute.identifier = 'key';
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.document.model.attributes.some((a) => a.identifier === 'key')).toBe(true);
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
