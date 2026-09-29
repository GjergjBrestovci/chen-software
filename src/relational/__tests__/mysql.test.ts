import { describe, expect, it } from 'vitest';
import { messages } from '../../i18n/messages.en';
import { createColumnSpec } from '../../model/column';
import type { ColumnSpec } from '../../model/types';
import { mapModel } from '../mapModel';
import { quoteIdentifier, quoteString, renderMysql } from '../mysql';
import type { Column, RelationalSchema, Table } from '../types';
import { Diagram } from './diagram';

const text = messages.sql;
const options = { title: 'Test', dropExisting: false };

function col(name: string, spec: Partial<ColumnSpec> = {}, rest: Partial<Column> = {}): Column {
  return {
    name,
    spec: { ...createColumnSpec(), type: 'INT', ...spec },
    notNull: false,
    autoIncrement: false,
    defaultValue: null,
    ...rest,
  };
}

function tbl(name: string, columns: Column[], rest: Partial<Table> = {}): Table {
  return {
    name,
    sourceId: name,
    columns,
    primaryKey: [],
    uniques: [],
    foreignKeys: [],
    ...rest,
  };
}

function render(tables: Table[], notes: string[] = []): { sql: string; notes: string[] } {
  const schema: RelationalSchema = { tables, notes };
  return renderMysql(schema, options);
}

/** The one line that declares `name`, without its trailing comma. */
function line(sql: string, name: string): string {
  const found = sql.split('\n').find((candidate) => candidate.startsWith(`  \`${name}\` `));
  return (found ?? '').trim().replace(/,$/, '');
}

describe('quoting', () => {
  it('backticks identifiers, doubling any backtick inside', () => {
    expect(quoteIdentifier('order')).toBe('`order`');
    expect(quoteIdentifier('we`ird')).toBe('`we``ird`');
  });

  it('single-quotes strings, escaping quotes and backslashes', () => {
    expect(quoteString("it's")).toBe("'it''s'");
    expect(quoteString('a\\b')).toBe("'a\\\\b'");
  });
});

describe('column types', () => {
  it.each<[Partial<ColumnSpec>, string]>([
    [{ type: 'INT' }, 'INT'],
    [{ type: 'BIGINT' }, 'BIGINT'],
    [{ type: 'BOOLEAN' }, 'BOOLEAN'],
    [{ type: 'DOUBLE' }, 'DOUBLE'],
    [{ type: 'DATE' }, 'DATE'],
    [{ type: 'TEXT' }, 'TEXT'],
    [{ type: 'VARCHAR', length: 80 }, 'VARCHAR(80)'],
    [{ type: 'CHAR', length: 2 }, 'CHAR(2)'],
    [{ type: 'CHAR' }, 'CHAR'],
    [{ type: 'DECIMAL' }, 'DECIMAL'],
    [{ type: 'DECIMAL', precision: 8, scale: 2 }, 'DECIMAL(8, 2)'],
    [{ type: 'DECIMAL', precision: 8 }, 'DECIMAL(8)'],
    [{ type: 'DECIMAL', scale: 2 }, 'DECIMAL(10, 2)'],
    [{ type: 'INT', length: 30 }, 'INT'],
  ])('writes %o as %s', (spec, expected) => {
    const { sql, notes } = render([tbl('t', [col('c', spec)])]);
    expect(line(sql, 'c')).toBe(`\`c\` ${expected}`);
    expect(notes).toEqual([]);
  });

  it('falls back to VARCHAR(255) for columns with no type, listed in one note', () => {
    const { sql, notes } = render([tbl('t', [col('a', { type: null }), col('b', { type: null })])]);
    expect(line(sql, 'a')).toBe('`a` VARCHAR(255)');
    expect(notes).toEqual([text.missingTypes('t.a, t.b')]);
  });

  it('gives a VARCHAR with no length 255, and says so', () => {
    const { sql, notes } = render([tbl('t', [col('c', { type: 'VARCHAR' })])]);
    expect(line(sql, 'c')).toBe('`c` VARCHAR(255)');
    expect(notes).toEqual([text.missingLength('t.c')]);
  });

  it('shortens lengths MySQL does not allow, and says so', () => {
    const { sql, notes } = render([
      tbl('t', [
        col('v', { type: 'VARCHAR', length: 70_000 }),
        col('c', { type: 'CHAR', length: 300 }),
      ]),
    ]);
    expect(line(sql, 'v')).toBe('`v` VARCHAR(16383)');
    expect(line(sql, 'c')).toBe('`c` CHAR(255)');
    expect(notes).toEqual([text.lengthClamped('t.v', 16_383), text.lengthClamped('t.c', 255)]);
  });

  it.each<[Partial<ColumnSpec>, string]>([
    [{ precision: 70, scale: 2 }, 'DECIMAL(65, 2)'],
    [{ precision: 40, scale: 35 }, 'DECIMAL(40, 30)'],
    [{ precision: 4, scale: 6 }, 'DECIMAL(4, 4)'],
  ])('brings DECIMAL %o into range as %s, and says so', (spec, expected) => {
    const { sql, notes } = render([tbl('t', [col('d', { type: 'DECIMAL', ...spec })])]);
    expect(line(sql, 'd')).toBe(`\`d\` ${expected}`);
    expect(notes).toEqual([text.decimalClamped('t.d')]);
  });

  it('makes a TEXT key VARCHAR(255), since MySQL cannot index TEXT', () => {
    const { sql, notes } = render([
      tbl(
        't',
        [col('k', { type: 'TEXT' }), col('u', { type: 'TEXT' }), col('free', { type: 'TEXT' })],
        {
          primaryKey: ['k'],
          uniques: [['u']],
        },
      ),
    ]);
    expect(line(sql, 'k')).toBe('`k` VARCHAR(255)');
    expect(line(sql, 'u')).toBe('`u` VARCHAR(255)');
    expect(line(sql, 'free')).toBe('`free` TEXT');
    expect(notes).toEqual([text.textInKey('t.k'), text.textInKey('t.u')]);
  });

  it('says nothing more about a foreign key column than about the key it copies', () => {
    const { notes } = render([
      tbl('p', [col('id', { type: null })], { primaryKey: ['id'] }),
      tbl('c', [col('p_id', { type: null })], {
        foreignKeys: [
          { columns: ['p_id'], table: 'p', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
    ]);
    expect(notes).toEqual([text.missingTypes('p.id')]);
  });
});

describe('column modifiers', () => {
  it('writes NOT NULL, AUTO_INCREMENT and DEFAULT in that order', () => {
    const { sql } = render([
      tbl('t', [
        col('id', {}, { notNull: true, autoIncrement: true }),
        col('n', {}, { notNull: true, defaultValue: '3' }),
      ]),
    ]);
    expect(line(sql, 'id')).toBe('`id` INT NOT NULL AUTO_INCREMENT');
    expect(line(sql, 'n')).toBe('`n` INT NOT NULL DEFAULT 3');
  });

  it('leaves out a default on an AUTO_INCREMENT column, which MySQL refuses', () => {
    const { sql, notes } = render([
      tbl('t', [col('id', {}, { autoIncrement: true, defaultValue: '1' })]),
    ]);
    expect(line(sql, 'id')).toBe('`id` INT AUTO_INCREMENT');
    expect(notes).toEqual([]);
  });
});

describe('defaults', () => {
  it.each<[Partial<ColumnSpec>, string, string]>([
    [{ type: 'INT' }, ' 42 ', '42'],
    [{ type: 'INT' }, '-7', '-7'],
    [{ type: 'DECIMAL', precision: 6, scale: 2 }, '9.99', '9.99'],
    [{ type: 'DOUBLE' }, '1e3', '1e3'],
    [{ type: 'BOOLEAN' }, 'True', 'TRUE'],
    [{ type: 'BOOLEAN' }, '0', 'FALSE'],
    [{ type: 'VARCHAR', length: 20 }, "O'Brien", "'O''Brien'"],
    [{ type: 'CHAR', length: 3 }, ' x ', "' x '"],
    [{ type: 'VARCHAR', length: 20 }, '', "''"],
    [{ type: 'TEXT' }, 'none', "('none')"],
    [{ type: null }, 'n/a', "'n/a'"],
    [{ type: 'DATE' }, '2026-09-01', "'2026-09-01'"],
    [{ type: 'TIME' }, '08:30', "'08:30'"],
    [{ type: 'DATETIME' }, '2026-09-01 08:30:00', "'2026-09-01 08:30:00'"],
    [{ type: 'TIMESTAMP' }, 'current_timestamp', 'CURRENT_TIMESTAMP'],
    [{ type: 'DATETIME' }, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'],
  ])('for %o turns %j into %s', (spec, value, expected) => {
    const { sql, notes } = render([tbl('t', [col('c', spec, { defaultValue: value })])]);
    expect(line(sql, 'c')).toMatch(new RegExp(`DEFAULT ${expected.replace(/[()]/g, '\\$&')}$`));
    expect(notes.filter((note) => note.startsWith('The default'))).toEqual([]);
  });

  it.each<[Partial<ColumnSpec>, string]>([
    [{ type: 'INT' }, 'ten'],
    [{ type: 'INT' }, '1.5'],
    [{ type: 'DECIMAL' }, '1,5'],
    [{ type: 'BOOLEAN' }, 'yes'],
    [{ type: 'DATE' }, '1 Sept'],
    [{ type: 'DATE' }, 'CURRENT_TIMESTAMP'],
    [{ type: 'TIME' }, 'noon'],
  ])('for %o leaves out %j, and says so', (spec, value) => {
    const { sql, notes } = render([tbl('t', [col('c', spec, { defaultValue: value })])]);
    expect(line(sql, 'c')).not.toContain('DEFAULT');
    expect(notes).toEqual([text.invalidDefault('t.c', spec.type ?? '')]);
  });
});

describe('table structure', () => {
  it('writes the primary key, UNIQUE constraints and foreign keys after the columns', () => {
    const { sql } = render([
      tbl('p', [col('id')], { primaryKey: ['id'] }),
      tbl('c', [col('a'), col('b'), col('p_id')], {
        primaryKey: ['a', 'b'],
        uniques: [['b', 'p_id']],
        foreignKeys: [
          { columns: ['p_id'], table: 'p', referencedColumns: ['id'], onDeleteCascade: true },
        ],
      }),
    ]);
    expect(sql).toContain(
      [
        'CREATE TABLE `c` (',
        '  `a` INT,',
        '  `b` INT,',
        '  `p_id` INT,',
        '  PRIMARY KEY (`a`, `b`),',
        '  UNIQUE (`b`, `p_id`),',
        '  FOREIGN KEY (`p_id`) REFERENCES `p` (`id`) ON DELETE CASCADE',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
      ].join('\n'),
    );
  });

  it('creates referenced tables first, keeping the given order otherwise', () => {
    const { sql } = render([
      tbl('child', [col('p')], {
        foreignKeys: [
          { columns: ['p'], table: 'parent', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
      tbl('other', [col('x')]),
      tbl('parent', [col('id')], { primaryKey: ['id'] }),
    ]);
    const order = [...sql.matchAll(/CREATE TABLE `(\w+)`/g)].map((match) => match[1]);
    expect(order).toEqual(['other', 'parent', 'child']);
  });

  it('keeps a reference to its own table inline', () => {
    const { sql } = render([
      tbl('emp', [col('id'), col('boss')], {
        primaryKey: ['id'],
        foreignKeys: [
          { columns: ['boss'], table: 'emp', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
    ]);
    expect(sql).toContain('  FOREIGN KEY (`boss`) REFERENCES `emp` (`id`)\n)');
    expect(sql).not.toContain('ALTER TABLE');
  });

  it('adds a foreign key in a cycle afterwards with ALTER TABLE', () => {
    const { sql } = render([
      tbl('a', [col('id'), col('b_id')], {
        primaryKey: ['id'],
        foreignKeys: [
          { columns: ['b_id'], table: 'b', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
      tbl('b', [col('id'), col('a_id')], {
        primaryKey: ['id'],
        foreignKeys: [
          { columns: ['a_id'], table: 'a', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
    ]);
    expect(sql).toContain(
      'CREATE TABLE `a` (\n  `id` INT,\n  `b_id` INT,\n  PRIMARY KEY (`id`)\n)',
    );
    expect(sql).toContain('  FOREIGN KEY (`a_id`) REFERENCES `a` (`id`)\n)');
    expect(
      sql.trimEnd().endsWith('ALTER TABLE `a` ADD FOREIGN KEY (`b_id`) REFERENCES `b` (`id`);'),
    ).toBe(true);
  });
});

describe('the script', () => {
  it('starts with the title and, when there are any, the notes', () => {
    const { sql, notes } = render(
      [tbl('t', [col('c')])],
      ['First note.', 'First note.', 'Second.'],
    );
    expect(
      sql.startsWith(
        [
          `-- ${text.header('Test')}`,
          '--',
          `-- ${text.notesHeading}`,
          '-- - First note.',
          '-- - Second.',
          '',
          'CREATE',
        ].join('\n'),
      ),
    ).toBe(true);
    expect(notes).toEqual(['First note.', 'Second.']);
  });

  it('keeps a name with a line break inside its comment', () => {
    const { sql } = renderMysql(
      { tables: [], notes: ['Two\nlines.'] },
      { title: 'A\r\nB', dropExisting: false },
    );
    expect(sql).toBe(`-- ${text.header('A B')}\n--\n-- ${text.notesHeading}\n-- - Two lines.\n`);
  });

  it('drops the tables first, children before parents, when asked', () => {
    const tables = [
      tbl('parent', [col('id')], { primaryKey: ['id'] }),
      tbl('child', [col('p')], {
        foreignKeys: [
          { columns: ['p'], table: 'parent', referencedColumns: ['id'], onDeleteCascade: false },
        ],
      }),
    ];
    const { sql } = renderMysql({ tables, notes: [] }, { title: 'T', dropExisting: true });
    expect(sql).toContain(
      [
        'SET FOREIGN_KEY_CHECKS = 0;',
        'DROP TABLE IF EXISTS `child`;',
        'DROP TABLE IF EXISTS `parent`;',
        'SET FOREIGN_KEY_CHECKS = 1;',
        '',
        'CREATE TABLE `parent`',
      ].join('\n'),
    );
  });

  it('has nothing to drop for an empty diagram', () => {
    const { sql } = renderMysql({ tables: [], notes: [] }, { title: 'T', dropExisting: true });
    expect(sql).toBe(`-- ${text.header('T')}\n`);
  });

  it('keeps a student’s names exactly, reserved words included', () => {
    const schema = mapModel(
      new Diagram()
        .entity('o', 'regular', 'order')
        .key('k', 'o', { type: 'INT' })
        .attribute('g', 'o', {
          name: 'group by',
        }).model,
    );
    const { sql } = renderMysql(schema, options);
    expect(sql).toContain('CREATE TABLE `order` (');
    expect(sql).toContain('  `group by` VARCHAR(255),');
  });
});
