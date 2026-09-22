import { useEffect } from 'react';
import { findElementKind } from '../model/queries';
import type { ErDocument } from '../model/types';
import { useUiStore } from '../store/uiStore';

/**
 * Keeps selection and rename state pointing at elements that still exist.
 *
 * Undo and redo replace the whole document, so an element that was selected or
 * being renamed can simply vanish. Dropping those references here means every
 * path that changes the document is covered, rather than only the two buttons.
 */
export function useUiReconciler(document: ErDocument): void {
  const selectedIds = useUiStore((state) => state.selectedIds);
  const renamingId = useUiStore((state) => state.renamingId);
  const setSelectedIds = useUiStore((state) => state.setSelectedIds);
  const stopRenaming = useUiStore((state) => state.stopRenaming);

  useEffect(() => {
    const surviving = selectedIds.filter((id) => findElementKind(document.model, id) !== undefined);
    if (surviving.length !== selectedIds.length) {
      setSelectedIds(surviving);
    }

    if (renamingId !== null && findElementKind(document.model, renamingId) === undefined) {
      stopRenaming();
    }
  }, [document, renamingId, selectedIds, setSelectedIds, stopRenaming]);
}
