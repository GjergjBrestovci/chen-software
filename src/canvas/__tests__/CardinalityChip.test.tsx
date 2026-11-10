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
  return store().addRelationshipBetween([a, b], { x: 200, y: 0 });
}

function labelFor(relationshipId: string, value: Cardinality | null): CardinalityLabel {
  return {
    relationshipId,
    endIndex: 0,
    notation: 'classic',
    value,
    minMax: null,
    position: { x: 10, y: 20 },
  };
}

function endValue(relationshipId: string): Cardinality | null {
  return findRelationship(store().document.model, relationshipId)?.ends[0]?.cardinality ?? null;
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

    expect(findRelationship(store().document.model, id)?.ends[1]?.cardinality).toBeNull();
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

describe('CardinalityChip in the min-max notation', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('c'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    return () => {
      resetIdGenerator();
    };
  });

  function pairLabel(relationshipId: string): CardinalityLabel {
    return {
      relationshipId,
      endIndex: 0,
      notation: 'min-max',
      value: null,
      minMax: findRelationship(store().document.model, relationshipId)?.ends[0]?.minMax ?? null,
      position: { x: 10, y: 20 },
    };
  }

  const pairOf = (relationshipId: string): unknown =>
    findRelationship(store().document.model, relationshipId)?.ends[0]?.minMax;

  it('shows a dashed (?,?) placeholder while the pair is undecided', () => {
    const id = seedRelationship();
    render(<CardinalityChip label={pairLabel(id)} />);

    const button = screen.getByRole('button', { name: /not set yet/i });
    expect(button).toHaveTextContent('(?,?)');
    expect(button.className).toContain('chen-cardinality--unset');
  });

  it('stores a typed pair on Enter, and only on the clicked end', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();
    render(<CardinalityChip label={pairLabel(id)} />);

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByRole('textbox', { name: '(min,max) pair' }), '1,3{Enter}');

    expect(pairOf(id)).toEqual({ min: 1, max: 3 });
    expect(findRelationship(store().document.model, id)?.ends[1]?.minMax).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the field open and marked when the pair cannot be read', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();
    render(<CardinalityChip label={pairLabel(id)} />);

    await user.click(screen.getByRole('button'));
    const field = screen.getByRole('textbox');
    await user.type(field, '3,1{Enter}');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(pairOf(id)).toBeNull();
  });

  it('throws the draft away on Escape', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();
    render(<CardinalityChip label={pairLabel(id)} />);

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByRole('textbox'), '0,n{Escape}');

    expect(pairOf(id)).toBeNull();
    expect(screen.getByRole('button')).toHaveTextContent('(?,?)');
  });

  it('shows the stored pair and records one undo entry per change', async () => {
    const user = userEvent.setup();
    const id = seedRelationship();
    const { rerender } = render(<CardinalityChip label={pairLabel(id)} />);
    const before = useDocumentStore.temporal.getState().pastStates.length;

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByRole('textbox'), '0,n{Enter}');
    rerender(<CardinalityChip label={pairLabel(id)} />);

    expect(screen.getByRole('button', { name: /\(0,n\)/ })).toHaveTextContent('(0,n)');
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before + 1);

    await user.click(screen.getByRole('button'));
    await user.keyboard('{Enter}');
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before + 1);
  });
});
