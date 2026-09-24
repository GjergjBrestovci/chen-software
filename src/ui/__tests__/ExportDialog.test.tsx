// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../ExportDialog';
import { Notice } from '../Notice';
import { exportPdf } from '../../export/exportPdf';
import { DEFAULT_PDF_OPTIONS } from '../../export/pdfOptions';
import { createEmptyDocument, setTitle } from '../../model/operations';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

// The dialog imports this lazily; mocking it covers the dynamic import too.
vi.mock('../../export/exportPdf', () => ({ exportPdf: vi.fn(() => Promise.resolve()) }));

function openDialog(): void {
  act(() => {
    useUiStore.getState().openExportDialog();
  });
}

function renderDialog() {
  return render(
    <>
      <ExportDialog />
      <Notice />
    </>,
  );
}

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.mocked(exportPdf).mockReset();
    vi.mocked(exportPdf).mockResolvedValue(undefined);
    useDocumentStore.setState({ document: setTitle(createEmptyDocument(), 'Bookstore') });
    useUiStore.setState({
      exportDialogOpen: false,
      pdfOptions: DEFAULT_PDF_OPTIONS,
      notice: null,
    });
  });

  it('stays hidden until it is opened', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with the first option focused', async () => {
    openDialog();
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveFocus();
    });
  });

  it('remembers the options the student picks', async () => {
    const user = userEvent.setup();
    openDialog();
    renderDialog();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Page size' }), 'letter');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Orientation' }), 'portrait');
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Ada');
    await user.click(screen.getByRole('checkbox', { name: /standard chen notation/i }));

    expect(useUiStore.getState().pdfOptions).toEqual({
      pageSize: 'letter',
      orientation: 'portrait',
      includeHeader: true,
      studentName: 'Ada',
      standardNotation: true,
    });
  });

  it('greys out the name when there is no header to put it in', async () => {
    const user = userEvent.setup();
    openDialog();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /title at the top/i }));

    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeDisabled();
  });

  it('exports the current diagram with the chosen options, then closes', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ pdfOptions: { ...DEFAULT_PDF_OPTIONS, studentName: 'Ada' } });
    openDialog();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => {
      expect(useUiStore.getState().exportDialogOpen).toBe(false);
    });
    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bookstore' }),
      expect.objectContaining({ studentName: 'Ada' }),
    );
  });

  it('says so when the PDF cannot be made, and stays open', async () => {
    const user = userEvent.setup();
    vi.mocked(exportPdf).mockRejectedValue(new Error('boom'));
    openDialog();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/could not be created/i);
    expect(useUiStore.getState().exportDialogOpen).toBe(true);
  });

  it('closes on Cancel without exporting', async () => {
    const user = userEvent.setup();
    openDialog();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useUiStore.getState().exportDialogOpen).toBe(false);
    expect(exportPdf).not.toHaveBeenCalled();
  });

  it('closes on Escape without exporting', async () => {
    const user = userEvent.setup();
    openDialog();
    renderDialog();

    await user.keyboard('{Escape}');

    expect(useUiStore.getState().exportDialogOpen).toBe(false);
    expect(exportPdf).not.toHaveBeenCalled();
  });

  it('keeps typing in the dialog from reaching the canvas shortcuts', async () => {
    const user = userEvent.setup();
    const onWindowKeyDown = vi.fn();
    window.addEventListener('keydown', onWindowKeyDown);
    openDialog();
    renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'era');

    window.removeEventListener('keydown', onWindowKeyDown);
    expect(onWindowKeyDown).not.toHaveBeenCalled();
  });
});
