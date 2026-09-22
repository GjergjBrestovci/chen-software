// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { useFileActions } from '../useFileActions';
import { useDocumentStore } from '../documentStore';
import { useUiStore } from '../uiStore';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Notice } from '../../ui/Notice';
import { createEmptyDocument } from '../../model/operations';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import * as fileIO from '../../persistence/fileIO';

// Resolved from the project root: `import.meta.url` is not a file URL under jsdom.
function fixture(name: string): string {
  return readFileSync(`${process.cwd()}/fixtures/${name}`, 'utf8');
}

/** A File whose text() resolves to the given contents. */
function fakeFile(name: string, text: string): File {
  return { name, text: () => Promise.resolve(text) } as unknown as File;
}

const store = (): ReturnType<typeof useDocumentStore.getState> => useDocumentStore.getState();

describe('useFileActions', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('p'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    useUiStore.setState({
      selectedIds: [],
      renamingId: null,
      confirmation: null,
      exportedDocument: null,
      notice: null,
    });
    vi.restoreAllMocks();
    return () => {
      resetIdGenerator();
    };
  });

  it('reports unsaved changes until the diagram is written to a file', () => {
    const download = vi.spyOn(fileIO, 'downloadDocument').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useFileActions());

    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => {
      result.current.saveDiagram();
    });
    rerender();

    expect(download).toHaveBeenCalledOnce();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('reports unsaved changes again after the next edit', () => {
    vi.spyOn(fileIO, 'downloadDocument').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useFileActions());

    act(() => {
      result.current.saveDiagram();
    });
    rerender();
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    rerender();
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('starts a new diagram straight away when nothing is unsaved', () => {
    vi.spyOn(fileIO, 'downloadDocument').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useFileActions());

    // Separate acts, then a rerender: `result.current` is stale within one act,
    // so saving in the same act would export the pre-edit document.
    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    rerender();
    act(() => {
      result.current.saveDiagram();
    });
    rerender();
    act(() => {
      result.current.newDiagram();
    });

    expect(store().document.model.entities).toEqual([]);
    expect(useUiStore.getState().confirmation).toBeNull();
  });

  it('asks before discarding unsaved work', () => {
    const { result } = renderHook(() => useFileActions());

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    act(() => {
      result.current.newDiagram();
    });

    expect(useUiStore.getState().confirmation).not.toBeNull();
    expect(store().document.model.entities).toHaveLength(1);
  });

  it('keeps the diagram when the student cancels', async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useFileActions());
    render(<ConfirmDialog />);

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    act(() => {
      result.current.newDiagram();
    });

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(store().document.model.entities).toHaveLength(1);
    expect(useUiStore.getState().confirmation).toBeNull();
  });

  it('discards the diagram when the student confirms', async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useFileActions());
    render(<ConfirmDialog />);

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    act(() => {
      result.current.newDiagram();
    });

    await user.click(await screen.findByRole('button', { name: /discard/i }));

    expect(store().document.model.entities).toEqual([]);
  });

  it('clears the undo history with the old diagram', () => {
    vi.spyOn(fileIO, 'downloadDocument').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useFileActions());

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    rerender();
    act(() => {
      result.current.saveDiagram();
    });
    rerender();
    act(() => {
      result.current.newDiagram();
    });

    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('opens a chosen file and counts it as saved', async () => {
    vi.spyOn(fileIO, 'pickDocumentFile').mockResolvedValue(
      fakeFile('bookstore.erd.json', fixture('bookstore.erd.json')),
    );
    const { result, rerender } = renderHook(() => useFileActions());

    act(() => {
      result.current.openDiagram();
    });

    await waitFor(() => {
      expect(store().document.model.entities).toHaveLength(4);
    });
    rerender();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('migrates an old file as it opens', async () => {
    vi.spyOn(fileIO, 'pickDocumentFile').mockResolvedValue(
      fakeFile('old.erd.json', fixture('bookstore-v1.erd.json')),
    );
    const { result } = renderHook(() => useFileActions());

    act(() => {
      result.current.openDiagram();
    });

    await waitFor(() => {
      expect(store().document.version).toBe(2);
    });
  });

  it('explains a malformed file and loads nothing', async () => {
    vi.spyOn(fileIO, 'pickDocumentFile').mockResolvedValue(fakeFile('broken.json', '{ not json'));
    const { result } = renderHook(() => useFileActions());
    render(<Notice />);

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    act(() => {
      result.current.openDiagram();
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/JSON/);
    expect(store().document.model.entities).toHaveLength(1);
  });

  it('does nothing when the picker is cancelled', async () => {
    vi.spyOn(fileIO, 'pickDocumentFile').mockResolvedValue(null);
    const { result } = renderHook(() => useFileActions());

    act(() => {
      store().addEntityAt({ x: 0, y: 0 });
    });
    act(() => {
      result.current.openDiagram();
    });

    await waitFor(() => {
      expect(store().document.model.entities).toHaveLength(1);
    });
  });

  it('says how many elements it had to place', async () => {
    const document = JSON.parse(fixture('bookstore.erd.json')) as { layout: { positions: object } };
    document.layout.positions = {};
    vi.spyOn(fileIO, 'pickDocumentFile').mockResolvedValue(
      fakeFile('bare.erd.json', JSON.stringify(document)),
    );
    const { result } = renderHook(() => useFileActions());
    render(<Notice />);

    act(() => {
      result.current.openDiagram();
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/placed on the canvas/i);
  });
});
