// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardinalityChip } from '../edges/CardinalityChip';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { useDocumentStore } from '../../store/documentStore';
import { createEmptyDocument } from '../../model/operations';
import { findRelationship } from '../../model/queries';
import type { Cardinality } from '../../model/types';
import type { CardinalityLabel } from '../scene';

const store = (): ReturnType<typeof useDocumentStore.getState> => useDocumentStore.getState();

function seedRelationship(): string {
  const a = store().addEntityAt({ x: 0, y: 0 });
  const b = store().addEntityAt({ x: 400, y: 0 });
  return store().addRelationshipBetween(a, b, { x: 200, y: 0 });
}

function labelFor(relationshipId: string, value: Cardinality | null): CardinalityLabel {
  return { relationshipId, endIndex: 0, value, position: { x: 10, y: 20 } };
}

function endValue(relationshipId: string): Cardinality | null {
  return findRelationship(store().document.model, relationshipId)?.ends[0].cardinality ?? null;
}

describe('CardinalityChip', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('c'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    return () => {
      resetIdGenerator();
    };
  });

  it('shows a dashed ? placeholder while the end is undecided', () => {
    const id = seedRelationship();
    render(<CardinalityChip label={labelFor(id, null)} />);

    const button = screen.getByRole('button', { name: /not set yet/i });
    expect(button).toHaveTextContent('?');
    expect(button.className).toContain('chen-cardinality--unset');
  });

  it('shows the chosen letter once the student has decided', () => {
    const id = seedRelationship();
    render(<CardinalityChip label={labelFor(id, 'N')} />);

    const button = screen.getByRole('button', { name: /cardinality n/i });
    expect(button).toHaveTextContent('N');
    expect(button.className).not.toContain('chen-cardinality--unset');
  });

  it('cycles ? -> 1 -> N -> M -> 1 on click', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();

    const { rerender } = render(<CardinalityChip label={labelFor(id, endValue(id))} />);
    for (const expected of ['1', 'N', 'M', '1'] as const) {
      await user.click(screen.getByRole('button'));
      expect(endValue(id)).toBe(expected);
      rerender(<CardinalityChip label={labelFor(id, endValue(id))} />);
    }
  });

  it('changes only the end that was clicked', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();

    render(<CardinalityChip label={labelFor(id, null)} />);
    await user.click(screen.getByRole('button'));

    expect(findRelationship(store().document.model, id)?.ends[1].cardinality).toBeNull();
  });

  it('records one undo entry per click', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();
    render(<CardinalityChip label={labelFor(id, null)} />);

    const before = useDocumentStore.temporal.getState().pastStates.length;
    await user.click(screen.getByRole('button'));

    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before + 1);
  });

  it('positions itself where the geometry said, without affecting the model', () => {
    const id = seedRelationship();
    const snapshot = structuredClone(store().document.model);
    render(<CardinalityChip label={labelFor(id, '1')} />);

    expect(screen.getByRole('button').style.transform).toContain('10px, 20px');
    expect(store().document.model).toEqual(snapshot);
  });
});
