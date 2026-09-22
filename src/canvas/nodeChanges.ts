import type { NodeChange } from '@xyflow/react';
import type { ElementMove } from '../model/operations';
import type { Id, Position } from '../model/types';
import type { AppNode } from './scene';

/**
 * Reads a batch of React Flow node changes.
 *
 * Positions are reported separately from selection because they are committed
 * at different times: selection goes straight to `uiStore`, while positions are
 * held in component state until the drag stops, so a whole gesture becomes one
 * undo entry (SPEC.md §5).
 */
export interface NodeChangeResult {
  /** Positions seen in this batch, in the same space as `layout.positions`. */
  moved: Record<Id, Position>;
  /** The new selection, or `null` when this batch did not touch it. */
  selection: Id[] | null;
}

export function readNodeChanges(
  changes: readonly NodeChange<AppNode>[],
  currentSelection: readonly Id[],
): NodeChangeResult {
  const moved: Record<Id, Position> = {};
  const selection = new Set(currentSelection);
  let selectionChanged = false;

  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      moved[change.id] = change.position;
    } else if (change.type === 'select') {
      selectionChanged = true;
      if (change.selected) {
        selection.add(change.id);
      } else {
        selection.delete(change.id);
      }
    }
  }

  return { moved, selection: selectionChanged ? [...selection] : null };
}

/** Turns the positions held during a drag into a single move operation. */
export function toMoves(dragPositions: Readonly<Record<Id, Position>>): ElementMove[] {
  return Object.entries(dragPositions).map(([id, position]) => ({ id, position }));
}
