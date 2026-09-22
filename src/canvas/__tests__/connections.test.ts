import { describe, expect, it } from 'vitest';
import { decideConnect, decideConnectEnd } from '../connections';
import type { ElementKind } from '../../model/types';

const KINDS: Record<string, ElementKind> = {
  book: 'entity',
  author: 'entity',
  writes: 'relationship',
  isbn: 'attribute',
};
const kindOf = (id: string): ElementKind | undefined => KINDS[id];

describe('decideConnect', () => {
  const base = { relationshipModeActive: false, kindOf };

  it('creates a relationship between two entities', () => {
    expect(decideConnect({ ...base, source: 'book', target: 'author' })).toEqual({
      kind: 'create',
      source: 'book',
      target: 'author',
    });
  });

  it('does nothing while the student is picking by clicking', () => {
    // The bug: a click on a handle completed a connection *and* the pick,
    // so one pair of clicks made two relationships.
    expect(
      decideConnect({ ...base, relationshipModeActive: true, source: 'book', target: 'author' }),
    ).toEqual({ kind: 'ignore' });
  });

  it('refuses to connect an entity to itself here', () => {
    expect(decideConnect({ ...base, source: 'book', target: 'book' })).toEqual({
      kind: 'reject',
      reason: 'self',
    });
  });

  it('refuses anything that is not two entities', () => {
    for (const [source, target] of [
      ['book', 'writes'],
      ['writes', 'book'],
      ['book', 'isbn'],
      ['book', 'ghost'],
    ] as const) {
      expect(decideConnect({ ...base, source, target })).toEqual({
        kind: 'reject',
        reason: 'not-entities',
      });
    }
  });
});

describe('decideConnectEnd', () => {
  const base = {
    relationshipModeActive: false,
    handledByHandle: false,
    kindOf,
  };

  it('creates a relationship when released over another entity', () => {
    // The bug: releasing over the middle of a table did nothing, because React
    // Flow only connects within a few pixels of a handle.
    expect(decideConnectEnd({ ...base, source: 'book', target: 'author' })).toEqual({
      kind: 'create',
      source: 'book',
      target: 'author',
    });
  });

  it('leaves it alone when a handle already caught the connection', () => {
    expect(
      decideConnectEnd({ ...base, handledByHandle: true, source: 'book', target: 'author' }),
    ).toEqual({ kind: 'ignore' });
  });

  it('does nothing while the student is picking by clicking', () => {
    expect(
      decideConnectEnd({
        ...base,
        relationshipModeActive: true,
        source: 'book',
        target: 'author',
      }),
    ).toEqual({ kind: 'ignore' });
  });

  it('does nothing when released over empty canvas', () => {
    expect(decideConnectEnd({ ...base, source: 'book', target: undefined })).toEqual({
      kind: 'ignore',
    });
  });

  it('stays quiet when released back over the starting entity, as a plain click is', () => {
    expect(decideConnectEnd({ ...base, source: 'book', target: 'book' })).toEqual({
      kind: 'ignore',
    });
  });

  it('ignores a drag that did not start from an entity', () => {
    expect(decideConnectEnd({ ...base, source: 'writes', target: 'author' })).toEqual({
      kind: 'ignore',
    });
    expect(decideConnectEnd({ ...base, source: undefined, target: 'author' })).toEqual({
      kind: 'ignore',
    });
  });
});
