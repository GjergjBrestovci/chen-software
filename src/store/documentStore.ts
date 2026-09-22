import { create } from 'zustand';
import { temporal } from 'zundo';
import { attributeOffsetFor } from '../layout/placement';
import { nextCardinality } from '../model/cardinality';
import { createId } from '../model/ids';
import * as operations from '../model/operations';
import { findRelationship } from '../model/queries';
import type { Cardinality, EndIndex, ErDocument, Id, Position } from '../model/types';

/**
 * The document is the single source of truth. React Flow's nodes and edges are
 * derived from it every render (see `canvas/scene.ts`), never the other way
 * round, which is what makes SPEC.md §1.3 structurally true: layout lives in
 * the same document but in a separate field, and nothing in the canvas can
 * reach the semantic model except through these actions.
 *
 * Every action is exactly one user-visible step, so `zundo` records exactly one
 * history entry for it (SPEC.md §5). A drag is not an action: the canvas keeps
 * in-progress positions in local state and calls `moveMany` once, on drag stop.
 */
export interface DocumentStore {
  document: ErDocument;

  addEntityAt: (position: Position) => Id;
  addAttributeTo: (ownerId: Id) => Id;
  addRelationshipBetween: (firstEntityId: Id, secondEntityId: Id, position: Position) => Id;
  rename: (id: Id, name: string) => void;
  setCardinality: (relationshipId: Id, endIndex: EndIndex, value: Cardinality | null) => void;
  cycleCardinality: (relationshipId: Id, endIndex: EndIndex) => void;
  moveMany: (moves: readonly operations.ElementMove[]) => void;
  remove: (ids: readonly Id[]) => void;
  replaceDocument: (document: ErDocument) => void;
}

export const useDocumentStore = create<DocumentStore>()(
  temporal(
    (set, get) => ({
      document: operations.createEmptyDocument(),

      addEntityAt: (position) => {
        const id = createId();
        set({ document: operations.addEntity(get().document, { id, name: '', position }) });
        return id;
      },

      addAttributeTo: (ownerId) => {
        const id = createId();
        const document = get().document;
        set({
          document: operations.addAttribute(document, {
            id,
            ownerId,
            name: '',
            offset: attributeOffsetFor(document, ownerId, ''),
          }),
        });
        return id;
      },

      addRelationshipBetween: (firstEntityId, secondEntityId, position) => {
        const id = createId();
        set({
          document: operations.addRelationship(get().document, {
            id,
            name: '',
            entityIds: [firstEntityId, secondEntityId],
            position,
          }),
        });
        return id;
      },

      rename: (id, name) => {
        set({ document: operations.renameElement(get().document, { id, name }) });
      },

      setCardinality: (relationshipId, endIndex, value) => {
        set({
          document: operations.setCardinality(get().document, {
            relationshipId,
            endIndex,
            cardinality: value,
          }),
        });
      },

      cycleCardinality: (relationshipId, endIndex) => {
        const document = get().document;
        const relationship = findRelationship(document.model, relationshipId);
        if (!relationship) {
          return;
        }
        set({
          document: operations.setCardinality(document, {
            relationshipId,
            endIndex,
            cardinality: nextCardinality(relationship.ends[endIndex].cardinality),
          }),
        });
      },

      moveMany: (moves) => {
        if (moves.length === 0) {
          return;
        }
        set({ document: operations.moveElements(get().document, moves) });
      },

      remove: (ids) => {
        set({ document: operations.deleteElements(get().document, ids) });
      },

      replaceDocument: (document) => {
        set({ document });
      },
    }),
    {
      // Only the document is undoable. Selection, snap and rename state are not.
      partialize: (state) => ({ document: state.document }),
      limit: 200,
    },
  ),
);
