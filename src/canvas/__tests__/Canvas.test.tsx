// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { installReactFlowEnvironment } from './reactFlowEnvironment';
import { ANCHOR_HANDLE_ID } from '../nodes/AnchorHandle';
import { Canvas } from '../Canvas';
import { Notice } from '../../ui/Notice';
import { createEmptyDocument } from '../../model/operations';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

installReactFlowEnvironment();

const model = (): ReturnType<typeof useDocumentStore.getState>['document']['model'] =>
  useDocumentStore.getState().document.model;

/** Selects elements the way a click would, but without React Flow's pointer machinery. */
function select(ids: string[]): void {
  act(() => {
    useUiStore.getState().setSelectedIds(ids);
  });
}

/**
 * Clicks a shape by its name.
 *
 * A plain click rather than a full pointer sequence: React Flow's `onNodeClick`
 * is an ordinary React click handler, while a synthesized mousedown reaches
 * d3-drag, which dereferences `event.view` -- null in jsdom. That is a jsdom
 * gap, not app behaviour, so the test routes around it.
 */
function clickShape(name: string): void {
  fireEvent.click(screen.getByText(name));
}

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <Canvas />
      <Notice />
    </ReactFlowProvider>,
  );
}

describe('Canvas interactions', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('n'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    useUiStore.setState({
      selectedIds: [],
      renamingId: null,
      relationshipMode: { active: false, firstEntityId: null },
      notice: null,
      snapToGrid: true,
    });
    return () => {
      resetIdGenerator();
    };
  });

  it('creates an entity with the E shortcut and opens it for renaming', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');

    expect(model().entities).toHaveLength(1);
    expect(await screen.findByRole('textbox')).toHaveFocus();
  });

  it('names a new entity when the student presses Enter', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');

    await waitFor(() => {
      expect(model().entities[0]?.name).toBe('BOOK');
    });
  });

  it('leaves a new entity unnamed on Escape, rather than deleting it', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('{Escape}');

    expect(model().entities).toHaveLength(1);
    expect(model().entities[0]?.name).toBe('');
  });

  it('does not fire the E shortcut while the student is typing a name', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOKSTORE');

    expect(model().entities).toHaveLength(1);
  });

  it('adds an attribute to the selected entity with A', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');
    const entityId = model().entities[0]?.id ?? '';
    select([entityId]);

    await user.keyboard('a');

    expect(model().attributes).toHaveLength(1);
    expect(model().attributes[0]?.ownerId).toBe(entityId);
  });

  it('explains why A did nothing when no owner is selected', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('a');

    expect(await screen.findByRole('status')).toHaveTextContent(/select one entity/i);
    expect(model().attributes).toHaveLength(0);
  });

  it('refuses a self-relationship and keeps the first pick', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');

    await user.keyboard('r');
    expect(useUiStore.getState().relationshipMode.active).toBe(true);

    clickShape('BOOK');
    clickShape('BOOK');

    expect(await screen.findByRole('status')).toHaveTextContent(/two different entities/i);
    expect(model().relationships).toHaveLength(0);
    expect(useUiStore.getState().relationshipMode.active).toBe(true);
    expect(useUiStore.getState().relationshipMode.firstEntityId).not.toBeNull();
  });

  it('creates a relationship between two entities picked in relationship mode', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');
    await user.keyboard('e');
    await user.keyboard('AUTHOR{Enter}');

    await user.keyboard('r');
    clickShape('BOOK');
    clickShape('AUTHOR');

    await waitFor(() => {
      expect(model().relationships).toHaveLength(1);
    });
    expect(model().relationships[0]?.ends.map((end) => end.cardinality)).toEqual([null, null]);
    expect(useUiStore.getState().relationshipMode.active).toBe(false);
  });

  it('deletes the selection with Delete, cascading to attributes', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');
    const entityId = model().entities[0]?.id ?? '';
    select([entityId]);
    await user.keyboard('a');
    await user.keyboard('{Enter}');

    select([entityId]);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(model().entities).toHaveLength(0);
    });
    expect(model().attributes).toHaveLength(0);
  });

  it('toggles relationship mode off again with R', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.keyboard('r');
    expect(useUiStore.getState().relationshipMode.active).toBe(true);
    await user.keyboard('r');
    expect(useUiStore.getState().relationshipMode.active).toBe(false);
  });

  it('disables the attribute and delete buttons until something is selected', () => {
    renderCanvas();

    expect(screen.getByRole('button', { name: /add attribute/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete selection/i })).toBeDisabled();
  });

  it('gives every shape the anchor handle that edges resolve to', async () => {
    const user = userEvent.setup();
    const { container } = renderCanvas();

    await user.keyboard('e');
    await user.keyboard('BOOK{Enter}');

    await waitFor(() => {
      expect(
        container.querySelectorAll(`[data-handleid="${ANCHOR_HANDLE_ID}"]`).length,
      ).toBeGreaterThan(0);
    });
  });

  it('labels every toolbar button with its shortcut', () => {
    renderCanvas();

    expect(screen.getByRole('button', { name: /new entity \(E\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add attribute \(A\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /relationship \(R\)/i })).toBeInTheDocument();
  });

  it('records the snap-to-grid preference outside the undo history', async () => {
    const user = userEvent.setup();
    renderCanvas();

    const before = useDocumentStore.temporal.getState().pastStates.length;
    await user.click(screen.getByRole('checkbox', { name: /snap to grid/i }));

    expect(useUiStore.getState().snapToGrid).toBe(false);
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before);
  });
});
