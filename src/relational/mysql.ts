import { messages } from '../i18n/messages.en';
import { isIntegerType, isNumericType, isTemporalType, isTextType } from '../model/column';
import type { SqlType } from '../model/types';
import type { Column, ForeignKey, RelationalSchema, Table } from './types';

/**
 * Prints a relational schema as MySQL 8 DDL.
 *
 * Every identifier is backtick-quoted, so a student's names are kept exactly
 * as they wrote them and a table called `order` still works. Tables are
 * created so that each foreign key points at a table that already exists;
 * only a cycle of references needs an ALTER TABLE at the end.
 *
 * Whatever the student left unfinished is filled in with a safe default and
 * written up as a note, never refused.
 */

export interface MysqlOptions {
  /** The diagram title, for the header comment. */
  title: string;
  /** Start with DROP TABLE IF EXISTS, so the script can be run again. */
  dropExisting: boolean;
}

export interface SqlExport {
  sql: string;
  notes: string[];
}

const text = messages.sql;

const FALLBACK_TYPE = 'VARCHAR(255)';
const DEFAULT_VARCHAR_LENGTH = 255;
const MAX_CHAR_LENGTH = 255;
/** 65,535 bytes a row, at up to 4 bytes a character in utf8mb4. */
const MAX_VARCHAR_LENGTH = 16_383;
const MAX_DECIMAL_PRECISION = 65;
const MAX_DECIMAL_SCALE = 30;
const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';

const INTEGER_LITERAL = /^[+-]?\d+$/;
const DECIMAL_LITERAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const BOOLEAN_LITERALS: Readonly<Record<string, string>> = {
  true: 'TRUE',
  false: 'FALSE',
  '1': 'TRUE',
  '0': 'FALSE',
};
const TEMPORAL_LITERALS: Readonly<Partial<Record<SqlType, RegExp>>> = {
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  TIME: /^-?\d{1,3}:\d{2}(:\d{2}(\.\d{1,6})?)?$/,
  DATETIME: /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/,
  TIMESTAMP: /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/,
};

export function quoteIdentifier(name: string): string {
  return `\`${name.replaceAll('`', '``')}\``;
}

export function quoteString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function identifierList(names: readonly string[]): string {
  return names.map(quoteIdentifier).join(', ');
}

/** Comments are single lines; a stray newline in a name must not end one early. */
function comment(line: string): string {
  return line.length > 0 ? `-- ${line.replace(/\s*[\r\n]+\s*/g, ' ')}` : '--';
}

function foreignKeyClause(foreignKey: ForeignKey): string {
  const clause = `FOREIGN KEY (${identifierList(foreignKey.columns)}) REFERENCES ${quoteIdentifier(
    foreignKey.table,
  )} (${identifierList(foreignKey.referencedColumns)})`;
  return foreignKey.onDeleteCascade ? `${clause} ON DELETE CASCADE` : clause;
}

/** Columns MySQL has to index: keys, unique columns and foreign keys. */
function indexedColumns(table: Table): Set<string> {
  return new Set([
    ...table.primaryKey,
    ...table.uniques.flat(),
    ...table.foreignKeys.flatMap((foreignKey) => foreignKey.columns),
  ]);
}

/**
 * Creation order: each table after the tables it references, keeping the
 * schema's own order wherever there is a choice. When only a cycle is left,
 * the first remaining table goes next and its forward references are
 * returned to be added afterwards.
 */
function creationOrder(tables: readonly Table[]): {
  ordered: Table[];
  deferred: { table: Table; foreignKey: ForeignKey }[];
} {
  const created = new Set<string>();
  const remaining = [...tables];
  const ordered: Table[] = [];
  const deferred: { table: Table; foreignKey: ForeignKey }[] = [];
  const isReady = (table: Table): boolean =>
    table.foreignKeys.every((key) => key.table === table.name || created.has(key.table));

  while (remaining.length > 0) {
    const readyIndex = remaining.findIndex(isReady);
    const [table] = remaining.splice(Math.max(readyIndex, 0), 1);
    if (!table) break;
    for (const foreignKey of table.foreignKeys) {
      if (foreignKey.table !== table.name && !created.has(foreignKey.table)) {
        deferred.push({ table, foreignKey });
      }
    }
    created.add(table.name);
    ordered.push(table);
  }
  return { ordered, deferred };
}

/** A column's MySQL type, and why it differs from what the student chose, if it does. */
interface ResolvedType {
  sql: string;
  /** No type was chosen. These are gathered into a single note. */
  untyped: boolean;
  note: string | null;
}

function clampLength(name: string, length: number, limit: number): [number, string | null] {
  return length <= limit ? [length, null] : [limit, text.lengthClamped(name, limit)];
}

function decimalType(name: string, precision: number | null, scale: number | null): ResolvedType {
  const wantedPrecision = precision ?? 10;
  const fittedPrecision = Math.min(wantedPrecision, MAX_DECIMAL_PRECISION);
  const fittedScale = scale === null ? null : Math.min(scale, MAX_DECIMAL_SCALE, fittedPrecision);
  return {
    sql:
      fittedScale === null
        ? `DECIMAL(${fittedPrecision})`
        : `DECIMAL(${fittedPrecision}, ${fittedScale})`,
    untyped: false,
    note:
      fittedPrecision !== wantedPrecision || fittedScale !== scale
        ? text.decimalClamped(name)
        : null,
  };
}

function resolveType(column: Column, name: string, indexed: boolean): ResolvedType {
  const { type, length, precision, scale } = column.spec;

  if (type === null) {
    return { sql: FALLBACK_TYPE, untyped: true, note: null };
  }
  if (type === 'TEXT' && indexed) {
    return { sql: FALLBACK_TYPE, untyped: false, note: text.textInKey(name) };
  }
  if (type === 'VARCHAR') {
    if (length === null) {
      return {
        sql: `VARCHAR(${DEFAULT_VARCHAR_LENGTH})`,
        untyped: false,
        note: text.missingLength(name),
      };
    }
    const [fitted, note] = clampLength(name, length, MAX_VARCHAR_LENGTH);
    return { sql: `VARCHAR(${fitted})`, untyped: false, note };
  }
  if (type === 'CHAR' && length !== null) {
    const [fitted, note] = clampLength(name, length, MAX_CHAR_LENGTH);
    return { sql: `CHAR(${fitted})`, untyped: false, note };
  }
  if (type === 'DECIMAL' && (precision !== null || scale !== null)) {
    return decimalType(name, precision, scale);
  }
  return { sql: type, untyped: false, note: null };
}

class MysqlWriter {
  readonly notes: string[] = [];
  readonly untyped: string[] = [];

  /**
   * A foreign-key column copies its type from the column it references, so
   * anything worth saying about that type is said once, about the original.
   */
  private typeOf(table: Table, column: Column, indexed: boolean, copied: boolean): string {
    const name = `${table.name}.${column.name}`;
    const { sql, untyped, note } = resolveType(column, name, indexed);
    if (!copied && untyped) this.untyped.push(name);
    if (!copied && note !== null) this.notes.push(note);
    return sql;
  }

  /** The DEFAULT literal for a column, or `null` if it has none or it is invalid. */
  private defaultOf(table: Table, column: Column): string | null {
    if (column.defaultValue === null || column.autoIncrement) return null;
    const type = column.spec.type;
    const value =
      type === null || isTextType(type) ? column.defaultValue : column.defaultValue.trim();

    const literal = this.literal(type, value);
    if (literal === null) {
      this.notes.push(text.invalidDefault(`${table.name}.${column.name}`, type ?? FALLBACK_TYPE));
    }
    return literal;
  }

  private literal(type: SqlType | null, value: string): string | null {
    if (type === null || type === 'CHAR' || type === 'VARCHAR') return quoteString(value);
    // MySQL only accepts a TEXT default written as an expression.
    if (type === 'TEXT') return `(${quoteString(value)})`;
    if (type === 'BOOLEAN') return BOOLEAN_LITERALS[value.toLowerCase()] ?? null;
    if (isIntegerType(type)) return INTEGER_LITERAL.test(value) ? value : null;
    if (isNumericType(type)) return DECIMAL_LITERAL.test(value) ? value : null;
    if (isTemporalType(type)) {
      if ((type === 'DATETIME' || type === 'TIMESTAMP') && /^current_timestamp$/i.test(value)) {
        return 'CURRENT_TIMESTAMP';
      }
      return TEMPORAL_LITERALS[type]?.test(value) ? quoteString(value) : null;
    }
    return null;
  }

  createTable(table: Table, inlineKeys: readonly ForeignKey[]): string {
    const indexed = indexedColumns(table);
    const copied = new Set(table.foreignKeys.flatMap((foreignKey) => foreignKey.columns));
    const lines = table.columns.map((column) => {
      const parts = [
        quoteIdentifier(column.name),
        this.typeOf(table, column, indexed.has(column.name), copied.has(column.name)),
      ];
      if (column.notNull) parts.push('NOT NULL');
      if (column.autoIncrement) parts.push('AUTO_INCREMENT');
      const literal = this.defaultOf(table, column);
      if (literal !== null) parts.push(`DEFAULT ${literal}`);
      return parts.join(' ');
    });

    if (table.primaryKey.length > 0) {
      lines.push(`PRIMARY KEY (${identifierList(table.primaryKey)})`);
    }
    for (const unique of table.uniques) {
      lines.push(`UNIQUE (${identifierList(unique)})`);
    }
    lines.push(...inlineKeys.map(foreignKeyClause));
    return [
      `CREATE TABLE ${quoteIdentifier(table.name)} (`,
      lines.map((line) => `  ${line}`).join(',\n'),
      `) ${TABLE_OPTIONS};`,
    ].join('\n');
  }
}

export function renderMysql(schema: RelationalSchema, options: MysqlOptions): SqlExport {
  const writer = new MysqlWriter();
  const { ordered, deferred } = creationOrder(schema.tables);
  const deferredKeys = new Set(deferred.map(({ foreignKey }) => foreignKey));

  const statements = ordered.map((table) =>
    writer.createTable(
      table,
      table.foreignKeys.filter((foreignKey) => !deferredKeys.has(foreignKey)),
    ),
  );

  for (const { table, foreignKey } of deferred) {
    statements.push(
      `ALTER TABLE ${quoteIdentifier(table.name)} ADD ${foreignKeyClause(foreignKey)};`,
    );
  }

  const notes = [...schema.notes, ...writer.notes];
  if (writer.untyped.length > 0) {
    notes.push(text.missingTypes(writer.untyped.join(', ')));
  }
  const uniqueNotes = [...new Set(notes)];

  const header = [comment(text.header(options.title))];
  if (uniqueNotes.length > 0) {
    header.push(comment(''), comment(text.notesHeading));
    header.push(...uniqueNotes.map((note) => comment(`- ${note}`)));
  }

  const sections = [header.join('\n')];
  if (options.dropExisting && ordered.length > 0) {
    sections.push(
      [
        'SET FOREIGN_KEY_CHECKS = 0;',
        ...[...ordered]
          .reverse()
          .map((table) => `DROP TABLE IF EXISTS ${quoteIdentifier(table.name)};`),
        'SET FOREIGN_KEY_CHECKS = 1;',
      ].join('\n'),
    );
  }
  sections.push(...statements);

  return { sql: `${sections.join('\n\n')}\n`, notes: uniqueNotes };
}
