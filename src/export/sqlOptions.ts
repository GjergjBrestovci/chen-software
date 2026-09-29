/**
 * SQL export options, kept apart from `exportSql.ts` like the PDF options are,
 * so the UI store can remember them without importing the exporter.
 */
export interface SqlOptions {
  /** Start with DROP TABLE IF EXISTS, so the script can be run again. */
  dropExisting: boolean;
}

export const DEFAULT_SQL_OPTIONS: SqlOptions = { dropExisting: false };
