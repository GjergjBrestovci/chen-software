import { messages } from '../i18n/messages.en';
import type { ErDocument } from '../model/types';
import { downloadText, fileNameFor } from '../persistence/fileIO';
import { mapModel } from '../relational/mapModel';
import { renderMysql } from '../relational/mysql';
import type { SqlExport } from '../relational/mysql';

/**
 * SQL export: the diagram's tables as MySQL DDL. The column details it relies
 * on are invisible on the canvas and in the PDF; this is the one place they
 * show.
 */

export const SQL_EXTENSION = '.sql';
const SQL_MIME_TYPE = 'application/sql';

export type { SqlExport } from '../relational/mysql';

export interface SqlOptions {
  /** Start with DROP TABLE IF EXISTS, so the script can be run again. */
  dropExisting: boolean;
}

export const DEFAULT_SQL_OPTIONS: SqlOptions = { dropExisting: false };

/** Builds the SQL without saving it, so the dialog can preview it. */
export function buildSql(document: ErDocument, options: SqlOptions): SqlExport {
  const title =
    document.title.trim().length > 0 ? document.title.trim() : messages.document.untitled;
  return renderMysql(mapModel(document.model), { title, dropExisting: options.dropExisting });
}

/** Hands the SQL to the browser as a download named after the diagram. */
export function downloadSql(document: ErDocument, sql: string): void {
  downloadText(sql, fileNameFor(document.title, SQL_EXTENSION), SQL_MIME_TYPE);
}
