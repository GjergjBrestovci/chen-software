import { describe, expect, it } from 'vitest';
import type { NodeChange } from '@xyflow/react';
import { readNodeChanges, toMoves } from '../nodeChanges';
import type { AppNode } from '../scene';

type Change = NodeChange<AppNode>;

describe('readNodeChanges', () => {
  it('collects positions from a drag', () => {
    const changes: Change[] = [
      { id: 'book', type: 'position', position: { x: 10, y: 20 }, dragging: true },
    ];
    expect(readNodeChanges(changes, []).moved).toEqual({ book: { x: 10, y: 20 } });
  });

  it('keeps only the last position for an element in one batch', () => {
    const changes: Change[] = [
      { id: 'book', type: 'position', position: { x: 10, y: 20 }, dragging: true },
      { id: 'book', type: 'position', position: { x: 30, y: 40 }, dragging: true },
    ];
    expect(readNodeChanges(changes, []).moved).toEqual({ book: { x: 30, y: 40 } });
  });

  it('ignores a position change that carries no position', () => {
    const changes: Change[] = [{ id: 'book', type: 'position', dragging: true }];
    expect(readNodeChanges(changes, []).moved).toEqual({});
  });

  it('leaves the selection alone when nothing selected anything', () => {
    const changes: Change[] = [
      { id: 'book', type: 'position', position: { x: 1, y: 1 }, dragging: true },
    ];
    expect(readNodeChanges(changes, ['author']).selection).toBeNull();
  });

  it('adds to the selection', () => {
    const changes: Change[] = [{ id: 'book', type: 'select', selected: true }];
    expect(readNodeChanges(changes, ['author']).selection).toEqual(['author', 'book']);
  });

  it('removes from the selection', () => {
    const changes: Change[] = [{ id: 'author', type: 'select', selected: false }];
    expect(readNodeChanges(changes, ['author', 'book']).selection).toEqual(['book']);
  });

  it('handles a multi-selection batch', () => {
    const changes: Change[] = [
      { id: 'a', type: 'select', selected: true },
      { id: 'b', type: 'select', selected: true },
      { id: 'c', type: 'select', selected: false },
    ];
    expect(readNodeChanges(changes, ['c']).selection).toEqual(['a', 'b']);
  });

  it('reports an emptied selection as an empty list, not as "unchanged"', () => {
    const changes: Change[] = [{ id: 'a', type: 'select', selected: false }];
    expect(readNodeChanges(changes, ['a']).selection).toEqual([]);
  });

  it('reads positions and selection from the same batch', () => {
    const changes: Change[] = [
      { id: 'a', type: 'select', selected: true },
      { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true },
    ];
    const result = readNodeChanges(changes, []);
    expect(result.moved).toEqual({ a: { x: 5, y: 5 } });
    expect(result.selection).toEqual(['a']);
  });

  it('ignores change kinds the canvas does not handle', () => {
    const changes: Change[] = [
      { id: 'a', type: 'dimensions', dimensions: { width: 10, height: 10 } },
      { id: 'b', type: 'remove' },
    ];
    expect(readNodeChanges(changes, ['x'])).toEqual({ moved: {}, selection: null });
  });

  it('does not mutate the selection it was given', () => {
    const selection = ['a'];
    readNodeChanges([{ id: 'b', type: 'select', selected: true }], selection);
    expect(selection).toEqual(['a']);
  });
});

describe('toMoves', () => {
  it('turns a whole drag into one batch of moves', () => {
    expect(
      toMoves({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } }).sort((first, second) =>
        first.id.localeCompare(second.id),
      ),
    ).toEqual([
      { id: 'a', position: { x: 1, y: 2 } },
      { id: 'b', position: { x: 3, y: 4 } },
    ]);
  });

  it('produces nothing when no element moved', () => {
    expect(toMoves({})).toEqual([]);
  });
});
