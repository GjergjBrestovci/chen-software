import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import type { Orientation, PageSize } from '../export/pageLayout';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

/**
 * PDF export options (SPEC.md §8). The choices are remembered, so a student
 * types their name once and every later export matches.
 *
 * jsPDF and svg2pdf.js are imported only when Export is pressed, which keeps
 * them out of the bundle everyone downloads when the app opens.
 */
export function ExportDialog(): ReactElement | null {
  const open = useUiStore((state) => state.exportDialogOpen);
  const options = useUiStore((state) => state.pdfOptions);
  const setPdfOptions = useUiStore((state) => state.setPdfOptions);
  const close = useUiStore((state) => state.closeExportDialog);
  const notify = useUiStore((state) => state.notify);
  const [exporting, setExporting] = useState(false);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const onExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const { exportPdf } = await import('../export/exportPdf');
      await exportPdf(useDocumentStore.getState().document, options);
      close();
    } catch {
      notify(messages.pdf.failed);
    } finally {
      setExporting(false);
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
        className="chen-dialog chen-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={messages.pdf.dialogTitle}
      >
        <h2>{messages.pdf.dialogTitle}</h2>

        <label className="chen-field">
          <span>{messages.pdf.pageSize}</span>
          <select
            ref={firstFieldRef}
            value={options.pageSize}
            onChange={(event) => {
              setPdfOptions({ pageSize: event.target.value as PageSize });
            }}
          >
            <option value="a4">{messages.pdf.a4}</option>
            <option value="letter">{messages.pdf.letter}</option>
          </select>
        </label>

        <label className="chen-field">
          <span>{messages.pdf.orientation}</span>
          <select
            value={options.orientation}
            onChange={(event) => {
              setPdfOptions({ orientation: event.target.value as Orientation });
            }}
          >
            <option value="auto">{messages.pdf.auto}</option>
            <option value="portrait">{messages.pdf.portrait}</option>
            <option value="landscape">{messages.pdf.landscape}</option>
          </select>
        </label>

        <label className="chen-check">
          <input
            type="checkbox"
            checked={options.includeHeader}
            onChange={(event) => {
              setPdfOptions({ includeHeader: event.target.checked });
            }}
          />
          {messages.pdf.includeHeader}
        </label>

        <label className="chen-field">
          <span>{messages.pdf.studentName}</span>
          <input
            value={options.studentName}
            placeholder={messages.pdf.studentNamePlaceholder}
            disabled={!options.includeHeader}
            onChange={(event) => {
              setPdfOptions({ studentName: event.target.value });
            }}
          />
        </label>

        <label className="chen-check">
          <input
            type="checkbox"
            checked={options.standardNotation}
            onChange={(event) => {
              setPdfOptions({ standardNotation: event.target.checked });
            }}
          />
          <span>
            {messages.pdf.standardNotation}
            <small>{messages.pdf.standardNotationHint}</small>
          </span>
        </label>

        <div className="chen-dialog-actions">
          <button type="button" onClick={close}>
            {messages.dialog.cancel}
          </button>
          <button
            type="button"
            className="chen-dialog-primary"
            disabled={exporting}
            onClick={() => {
              void onExport();
            }}
          >
            {exporting ? messages.pdf.exporting : messages.pdf.export}
          </button>
        </div>
      </div>
    </div>
  );
}
