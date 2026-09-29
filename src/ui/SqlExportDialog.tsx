import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { buildSql, downloadSql } from '../export/exportSql';
import { messages } from '../i18n/messages.en';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

/**
 * The diagram as MySQL DDL, previewed before it is copied or downloaded. The
 * notes say how an unfinished diagram was read, the same way the SQL comments
 * do, so a student sees them without opening the file.
 */
export function SqlExportDialog(): ReactElement | null {
  const open = useUiStore((state) => state.sqlDialogOpen);
  const options = useUiStore((state) => state.sqlOptions);
  const setSqlOptions = useUiStore((state) => state.setSqlOptions);
  const close = useUiStore((state) => state.closeSqlDialog);
  const notify = useUiStore((state) => state.notify);
  const document = useDocumentStore((state) => state.document);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const result = useMemo(
    () => (open ? buildSql(document, options) : null),
    [open, document, options],
  );

  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    }
  }, [open]);

  if (!open || !result) {
    return null;
  }

  const onCopy = async (): Promise<void> => {
    try {
      await globalThis.navigator.clipboard.writeText(result.sql);
      notify(messages.sqlExport.copied);
    } catch {
      notify(messages.sqlExport.copyFailed);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="chen-dialog-backdrop" onKeyDown={onKeyDown}>
      <div
        className="chen-dialog chen-export-dialog chen-sql-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={messages.sqlExport.dialogTitle}
      >
        <h2>{messages.sqlExport.dialogTitle}</h2>

        <label className="chen-check">
          <input
            ref={firstFieldRef}
            type="checkbox"
            checked={options.dropExisting}
            onChange={(event) => {
              setSqlOptions({ dropExisting: event.target.checked });
            }}
          />
          <span>
            {messages.sqlExport.dropExisting}
            <small>{messages.sqlExport.dropExistingHint}</small>
          </span>
        </label>

        {result.notes.length > 0 && (
          <section className="chen-sql-notes" aria-label={messages.sqlExport.notes}>
            <h3>{messages.sqlExport.notes}</h3>
            <ul>
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}

        <pre className="chen-sql-preview" tabIndex={0} aria-label={messages.sqlExport.preview}>
          {result.sql}
        </pre>

        <div className="chen-dialog-actions">
          <button type="button" onClick={close}>
            {messages.dialog.close}
          </button>
          <button
            type="button"
            onClick={() => {
              void onCopy();
            }}
          >
            {messages.sqlExport.copy}
          </button>
          <button
            type="button"
            className="chen-dialog-primary"
            onClick={() => {
              downloadSql(document, result.sql);
              close();
            }}
          >
            {messages.sqlExport.download}
          </button>
        </div>
      </div>
    </div>
  );
}
