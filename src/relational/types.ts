import type { ColumnSpec, Id } from '../model/types';

/**
 * The relational schema an ER model maps to: tables, columns and keys, with
 * no SQL syntax. `mapModel` builds it and a dialect renderer prints it, so a
 * later relational view (SPEC.md §2) can show the same tables the export writes.
 */

export interface Column {
  name: string;
  /**
   * Type details as the student chose them. A foreign-key column carries a
   * copy of the column it references, because MySQL insists they match.
   */
  spec: ColumnSpec;
  notNull: boolean;
  /** Resolved: only ever true on a single-column integer primary key. */
  autoIncrement: boolean;
  defaultValue: string | null;
}

export interface ForeignKey {
  columns: string[];
  /** Name of the referenced table. */
  table: string;
  referencedColumns: string[];
  /** A weak entity's row cannot outlive its owner's. */
  onDeleteCascade: boolean;
}

export interface Table {
  name: string;
  /** The entity, relationship or multivalued attribute the table stands for. */
  sourceId: Id;
  columns: Column[];
  primaryKey: string[];
  /** Each entry is one UNIQUE constraint over those columns. */
  uniques: string[][];
  foreignKeys: ForeignKey[];
}

export interface RelationalSchema {
  tables: Table[];
  /**
   * What the student should know about how the diagram was read: a missing
   * cardinality treated as many, a derived attribute left out, and so on.
   * One plain sentence each, like the diagram checks.
   */
  notes: string[];
}
