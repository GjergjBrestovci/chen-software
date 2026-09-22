import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrateToCurrent, readDocument, readDocumentJson } from '../migrations';
import { createEmptyDocument } from '../../model/operations';
import { DEFAULT_THEME } from '../../model/presentation';
import { CURRENT_VERSION } from '../../model/schema';
import type { ErDocument } from '../../model/types';

function fixture(name: string): string {
  return readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8');
}

function v1(): unknown {
  return JSON.parse(fixture('bookstore-v1.erd.json'));
}

/** Applies a mutation to a deep copy of the version 1 fixture. */
function brokenV1(mutate: (raw: Record<string, unknown>) => void): unknown {
  const raw = JSON.parse(fixture('bookstore-v1.erd.json')) as Record<string, unknown>;
  mutate(raw);
  return raw;
}

function migrated(): ErDocument {
  const outcome = readDocument(v1());
  if (!outcome.ok) {
    throw new Error(outcome.message);
  }
  return outcome.value.document;
}

describe('migrateToCurrent', () => {
  it('leaves a current document alone', () => {
    const document = createEmptyDocument();
    const outcome = migrateToCurrent(document);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value).toBe(document);
  });

  it('upgrades a version 1 document to the current version', () => {
    const outcome = migrateToCurrent(v1());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect((outcome.value as ErDocument).version).toBe(CURRENT_VERSION);
  });

  it('rejects a version it does not know', () => {
    const outcome = migrateToCurrent(brokenV1((raw) => (raw['version'] = 99)));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('99');
  });

  it('rejects a damaged version 1 file before transforming it', () => {
    const outcome = migrateToCurrent(
      brokenV1((raw) => {
        raw['model'] = { entities: 'nope' };
      }),
    );
    expect(outcome.ok).toBe(false);
  });

  it('passes through input with no readable version, for the schema to reject', () => {
    const outcome = migrateToCurrent({ hello: 'world' });
    expect(outcome.ok).toBe(true);
  });
});

describe('version 1 to 2', () => {
  it('preserves every element', () => {
    const document = migrated();
    expect(document.model.entities).toHaveLength(4);
    expect(document.model.relationships).toHaveLength(3);
    expect(document.model.attributes).toHaveLength(11);
  });

  it('preserves names, positions and dismissals exactly', () => {
    const before = v1() as ErDocument;
    const after = migrated();
    expect(after.title).toBe(before.title);
    expect(after.layout.positions).toEqual(before.layout.positions);
    expect(after.dismissedHints).toEqual(before.dismissedHints);
  });

  it('turns a version 1 key into a key identifier, and simple into none', () => {
    const document = migrated();
    const keys = document.model.attributes.filter((a) => a.identifier === 'key');
    expect(keys.map((a) => a.name).sort()).toEqual(['author_id', 'isbn', 'name', 'type']);
    expect(document.model.attributes.every((a) => a.shape === 'simple')).toBe(true);
    expect(document.model.attributes.every((a) => !a.foreignKey)).toBe(true);
  });

  it('makes every entity and relationship regular', () => {
    const document = migrated();
    expect(document.model.entities.every((e) => e.kind === 'regular')).toBe(true);
    expect(document.model.relationships.every((r) => r.kind === 'regular')).toBe(true);
  });

  it('keeps cardinalities and defaults participation to partial with no role', () => {
    const document = migrated();
    const published = document.model.relationships.find((r) => r.name === 'published_by');
    expect(published?.ends.map((end) => end.cardinality)).toEqual(['1', 'N']);
    expect(published?.ends.every((end) => end.participation === 'partial')).toBe(true);
    expect(published?.ends.every((end) => end.role === null)).toBe(true);
  });

  it('adds the default theme and no colour overrides', () => {
    const document = migrated();
    expect(document.presentation.theme).toEqual(DEFAULT_THEME);
    expect(document.presentation.colors).toEqual({});
  });

  it('produces a document the current schema accepts', () => {
    expect(readDocument(v1()).ok).toBe(true);
  });

  it('matches the version 2 fixture it was upgraded from', () => {
    const upgraded = migrated();
    const current = JSON.parse(fixture('bookstore.erd.json')) as ErDocument;
    expect(upgraded).toEqual(current);
  });

  it('does not mutate its input', () => {
    const raw = v1();
    const snapshot = structuredClone(raw);
    migrateToCurrent(raw);
    expect(raw).toEqual(snapshot);
  });
});

describe('readDocumentJson', () => {
  it('reads a current file', () => {
    expect(readDocumentJson(fixture('university.erd.json')).ok).toBe(true);
  });

  it('reads and upgrades an old file', () => {
    expect(readDocumentJson(fixture('bookstore-v1.erd.json')).ok).toBe(true);
  });

  it('reports unreadable JSON separately from an invalid diagram', () => {
    const outcome = readDocumentJson('{ not json');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('JSON');
  });

  it('rejects valid JSON that is not a diagram', () => {
    expect(readDocumentJson('{"hello":"world"}').ok).toBe(false);
  });
});

describe('readDocument surfaces migration failures', () => {
  it('reports an unsupported version rather than a schema error', () => {
    const outcome = readDocument(brokenV1((raw) => (raw['version'] = 99)));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('99');
  });

  it('reports a damaged old file as invalid', () => {
    const outcome = readDocument(
      brokenV1((raw) => {
        raw['dismissedHints'] = 'nope';
      }),
    );
    expect(outcome.ok).toBe(false);
  });
});
