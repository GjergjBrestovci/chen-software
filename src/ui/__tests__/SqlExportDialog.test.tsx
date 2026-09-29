// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Notice } from '../Notice';
import { SqlExportDialog } from '../SqlExportDialog';
import { buildSql, downloadSql } from '../../export/exportSql';
import type * as ExportSql from '../../export/exportSql';
import { DEFAULT_SQL_OPTIONS } from '../../export/sqlOptions';
import { messages } from '../../i18n/messages.en';
import { addAttribute, addEntity, createEmptyDocument, setTitle } from '../../model/operations';
import type { ErDocument } from '../../model/types';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

vi.mock('../../export/exportSql', async (importOriginal) => ({
  ...(await importOriginal<typeof ExportSql>()),
  downloadSql: vi.fn(),
}));

const text = messages.sqlExport;

/** BOOK with a key, and a derived attribute so there is a note to show. */
function bookstore(): ErDocument {
  let document = setTitle(createEmptyDocument(), 'Bookstore');
  document = addEntity(document, { id: 'b', name: 'BOOK', position: { x: 0, y: 0 } });
  document = addAttribute(document, {
    id: 'isbn',
    ownerId: 'b',
    name: 'isbn',
    identifier: 'key',
    offset: { x: 0, y: 0 },
  });
  return addAttribute(document, {
    id: 'age',
    ownerId: 'b',
    name: 'age',
    shape: 'derived',
    offset: { x: 0, y: 0 },
  });
}

function openDialog(): void {
  act(() => {
    useUiStore.getState().openSqlDialog();
  });
}

function renderDialog() {
  return render(
    <>
      <SqlExportDialog />
      <Notice />
    </>,
  );
}

function preview(): HTMLElement {
  return screen.getByLabelText(text.preview);
}

describe('SqlExportDialog', () => {
  beforeEach(() => {
    vi.mocked(downloadSql).mockReset();
    useDocumentStore.setState({ document: bookstore() });
    useUiStore.setState({ sqlDialogOpen: false, sqlOptions: DEFAULT_SQL_OPTIONS, notice: null });
  });

  it('stays hidden until it is opened', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('previews the SQL for the diagram, with the first option focused', () => {
    openDialog();
    renderDialog();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(text.dialogTitle);
    expect(preview().textContent).toBe(buildSql(bookstore(), DEFAULT_SQL_OPTIONS).sql);
    expect(screen.getByRole('checkbox', { name: new RegExp(text.dropExisting) })).toHaveFocus();
  });

  it('lists how the diagram was read', () => {
    openDialog();
    renderDialog();
    const notes = screen.getByRole('region', { name: text.notes });
    expect(notes).toHaveTextContent(messages.sql.derivedLeftOut('age', 'BOOK'));
  });

  it('has no notes section when there is nothing to say', () => {
    useDocumentStore.setState({ document: setTitle(createEmptyDocument(), 'Empty') });
    openDialog();
    renderDialog();
    expect(screen.queryByRole('region', { name: text.notes })).not.toBeInTheDocument();
  });

  it('adds DROP TABLE statements when asked, and remembers the choice', async () => {
    openDialog();
    renderDialog();
    expect(preview()).not.toHaveTextContent('DROP TABLE');

    await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(text.dropExisting) }));

    expect(preview()).toHaveTextContent('DROP TABLE IF EXISTS `BOOK`;');
    expect(useUiStore.getState().sqlOptions.dropExisting).toBe(true);
  });

  it('follows the diagram while open', () => {
    openDialog();
    renderDialog();
    act(() => {
      useDocumentStore.setState({
        document: addEntity(bookstore(), { id: 'p', name: 'PUBLISHER', position: { x: 0, y: 0 } }),
      });
    });
    expect(preview()).toHaveTextContent('CREATE TABLE `PUBLISHER`');
  });

  it('downloads the previewed SQL and closes', async () => {
    openDialog();
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: text.download }));
    expect(downloadSql).toHaveBeenCalledWith(
      useDocumentStore.getState().document,
      buildSql(bookstore(), DEFAULT_SQL_OPTIONS).sql,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the SQL and says so', async () => {
    openDialog();
    renderDialog();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: text.copy }));

    expect(writeText).toHaveBeenCalledWith(buildSql(bookstore(), DEFAULT_SQL_OPTIONS).sql);
    expect(await screen.findByText(text.copied)).toBeInTheDocument();
  });

  it('says so when the clipboard refuses', async () => {
    openDialog();
    renderDialog();
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(screen.getByRole('button', { name: text.copy }));

    expect(await screen.findByText(text.copyFailed)).toBeInTheDocument();
  });

  it('closes on Close and on Escape', async () => {
    openDialog();
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: messages.dialog.close }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openDialog();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
