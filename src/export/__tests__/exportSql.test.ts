// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSql, DEFAULT_SQL_OPTIONS, downloadSql } from '../exportSql';
import type { SqlOptions } from '../exportSql';
import { messages } from '../../i18n/messages.en';
import { setTitle } from '../../model/operations';
import type { ErDocument } from '../../model/types';
import { readDocumentJson } from '../../persistence/migrations';
import { Diagram } from '../../relational/__tests__/diagram';

/**
 * The SQL for each fixture is compared with a file in `fixtures/sql/`, byte for
 * byte. Those files are what `npm run verify:sql` runs against a real MySQL,
 * so a change here that MySQL would reject shows up there.
 *
 * After an intended change to the output, regenerate them with
 * `UPDATE_SQL_FIXTURES=1 npx vitest run src/export/__tests__/exportSql.test.ts`
 * and review the diff.
 */

const UPDATE = process.env['UPDATE_SQL_FIXTURES'] === '1';

function fixture(name: string): ErDocument {
  const outcome = readDocumentJson(
    readFileSync(`${process.cwd()}/fixtures/${name}.erd.json`, 'utf8'),
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.document;
}

function expectMatchesFile(name: string, sql: string): void {
  const path = `${process.cwd()}/fixtures/sql/${name}.sql`;
  if (UPDATE) {
    writeFileSync(path, sql);
  }
  expect(sql).toBe(readFileSync(path, 'utf8'));
}

/**
 * Everything the reference diagrams do not reach: a reserved word as a table
 * name, every kind of default, a TEXT key, a chain of weak entities, a cycle
 * of foreign keys, a self-relationship without roles, a ternary relationship
 * with two `1` ends, a 1:1 relationship, a multivalued relationship attribute
 * and a foreign key whose type had to be matched.
 */
function edgeCases(): ErDocument {
  const diagram = new Diagram()
    .entity('ORDER', 'regular', 'order')
    .key('order_id', 'ORDER', { type: 'INT', autoIncrement: true })
    .attribute('placed', 'ORDER', {
      column: { type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
    })
    .attribute('note', 'ORDER', { column: { type: 'TEXT', defaultValue: "it's fine" } })
    .attribute('paid', 'ORDER', { column: { type: 'BOOLEAN', defaultValue: 'false' } })
    .attribute('total', 'ORDER', {
      column: { type: 'DECIMAL', precision: 10, scale: 2, notNull: true, defaultValue: '0.00' },
    })
    .attribute('due', 'ORDER', { column: { type: 'DATE', defaultValue: '2026-12-31' } })
    .attribute('code', 'ORDER', { column: { type: 'VARCHAR', unique: true } })
    .entity('TAG')
    .attribute('label', 'TAG', { identifier: 'key', column: { type: 'TEXT' } })
    .relationship('tagged', [
      ['ORDER', { cardinality: 'M' }],
      ['TAG', { cardinality: 'N' }],
    ])
    .attribute('tagged_at', 'tagged', {
      column: { type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
    })
    .attribute('by', 'tagged', { shape: 'multivalued', column: { type: 'VARCHAR', length: 40 } })
    .entity('BUILDING')
    .key('building_name', 'BUILDING', { type: 'VARCHAR', length: 50 })
    .entity('ROOM', 'weak')
    .attribute('number', 'ROOM', { identifier: 'partial', column: { type: 'SMALLINT' } })
    .entity('SEAT', 'weak')
    .attribute('seat', 'SEAT', { identifier: 'partial', column: { type: 'CHAR', length: 3 } })
    .relationship(
      'contains',
      [
        ['BUILDING', { cardinality: '1' }],
        ['ROOM', { participation: 'total' }],
      ],
      'identifying',
    )
    .relationship(
      'has',
      [
        ['ROOM', { cardinality: '1' }],
        ['SEAT', { participation: 'total' }],
      ],
      'identifying',
    )
    .entity('A')
    .key('a_id', 'A')
    .entity('B')
    .key('b_id', 'B')
    .attribute('b_ref', 'A', { foreignKey: true, column: { type: 'BIGINT', references: 'B' } })
    .attribute('a_ref', 'B', { foreignKey: true, column: { references: 'A' } })
    .entity('PERSON')
    .key('person_id', 'PERSON')
    .relationship('knows', [
      ['PERSON', {}],
      ['PERSON', {}],
    ])
    .relationship('assigned', [
      ['PERSON', { cardinality: '1' }],
      ['SEAT', { cardinality: '1' }],
      ['ORDER', { cardinality: 'N' }],
    ])
    .entity('BADGE')
    .key('badge_no', 'BADGE', { type: 'CHAR', length: 8 })
    .relationship('wears', [
      ['PERSON', { cardinality: '1' }],
      ['BADGE', { cardinality: '1', participation: 'total' }],
    ]);
  return setTitle(diagram.doc, 'Edge cases');
}

describe('buildSql', () => {
  it.each<[string, () => ErDocument, SqlOptions]>([
    ['bookstore', () => fixture('bookstore'), { dropExisting: true }],
    ['bookstore-broken', () => fixture('bookstore-broken'), DEFAULT_SQL_OPTIONS],
    ['university', () => fixture('university'), DEFAULT_SQL_OPTIONS],
    ['edge-cases', edgeCases, { dropExisting: true }],
  ])('writes %s exactly as fixtures/sql records it', (name, document, options) => {
    expectMatchesFile(name, buildSql(document(), options).sql);
  });

  it('returns the notes it wrote into the script', () => {
    const { sql, notes } = buildSql(fixture('university'), DEFAULT_SQL_OPTIONS);
    expect(notes).toEqual([messages.sql.derivedLeftOut('age', 'STUDENT')]);
    expect(sql).toContain(`-- - ${messages.sql.derivedLeftOut('age', 'STUDENT')}`);
  });

  it('names an untitled diagram in the header', () => {
    const { sql } = buildSql(setTitle(fixture('bookstore'), '  '), DEFAULT_SQL_OPTIONS);
    expect(sql.startsWith(`-- ${messages.sql.header(messages.document.untitled)}`)).toBe(true);
  });
});

describe('downloadSql', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the script as a .sql file named after the diagram', () => {
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:sql');
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('bookstore.sql');
      expect(this.href).toBe('blob:sql');
    });

    downloadSql(fixture('bookstore'), 'SELECT 1;\n');

    expect(clicked).toHaveBeenCalledOnce();
    const blob = created.mock.calls[0]?.[0];
    expect(blob?.type).toBe('application/sql');
    expect(blob?.size).toBe('SELECT 1;\n'.length);
  });
});
