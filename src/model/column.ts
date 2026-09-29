import type { ColumnSpec, SqlType } from './types';

/**
 * The column details behind the SQL export. The type list is MySQL's, in the
 * order the menu offers them: numbers, then text, then dates and times.
 */

export const SQL_TYPES = [
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'DECIMAL',
  'DOUBLE',
  'BOOLEAN',
  'CHAR',
  'VARCHAR',
  'TEXT',
  'DATE',
  'TIME',
  'DATETIME',
  'TIMESTAMP',
] as const satisfies readonly SqlType[];

const INTEGER_TYPES: ReadonlySet<SqlType> = new Set(['INT', 'BIGINT', 'SMALLINT', 'TINYINT']);
const NUMERIC_TYPES: ReadonlySet<SqlType> = new Set([...INTEGER_TYPES, 'DECIMAL', 'DOUBLE']);
const TEXT_TYPES: ReadonlySet<SqlType> = new Set(['CHAR', 'VARCHAR', 'TEXT']);
const TEMPORAL_TYPES: ReadonlySet<SqlType> = new Set(['DATE', 'TIME', 'DATETIME', 'TIMESTAMP']);

/** A fresh column with nothing chosen: what every new attribute starts with. */
export function createColumnSpec(): ColumnSpec {
  return {
    type: null,
    length: null,
    precision: null,
    scale: null,
    notNull: false,
    unique: false,
    autoIncrement: false,
    defaultValue: null,
    references: null,
  };
}

export function isIntegerType(type: SqlType): boolean {
  return INTEGER_TYPES.has(type);
}

export function isNumericType(type: SqlType): boolean {
  return NUMERIC_TYPES.has(type);
}

export function isTextType(type: SqlType): boolean {
  return TEXT_TYPES.has(type);
}

export function isTemporalType(type: SqlType): boolean {
  return TEMPORAL_TYPES.has(type);
}

/** CHAR(n) and VARCHAR(n) take a length. */
export function takesLength(type: SqlType): boolean {
  return type === 'CHAR' || type === 'VARCHAR';
}

/** DECIMAL(p, s) takes a precision and scale. */
export function takesPrecision(type: SqlType): boolean {
  return type === 'DECIMAL';
}
