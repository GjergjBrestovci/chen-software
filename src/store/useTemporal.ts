import { useStore } from 'zustand';
import { useDocumentStore } from './documentStore';

/**
 * React bindings for the zundo history attached to `documentStore`.
 *
 * The history holds documents only (see `partialize` there), so undo restores
 * the model and the layout but never the selection, the rename box or the snap
 * toggle. Those live in `uiStore` and are not steps a student would expect to
 * walk back through (SPEC.md §5).
 */
export function useCanUndo(): boolean {
  return useStore(useDocumentStore.temporal, (state) => state.pastStates.length > 0);
}

export function useCanRedo(): boolean {
  return useStore(useDocumentStore.temporal, (state) => state.futureStates.length > 0);
}

export function undo(): void {
  useDocumentStore.temporal.getState().undo();
}

export function redo(): void {
  useDocumentStore.temporal.getState().redo();
}

export function clearHistory(): void {
  useDocumentStore.temporal.getState().clear();
}
