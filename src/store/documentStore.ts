import { create } from 'zustand';
import { temporal } from 'zundo';
import { attributeOffsetFor } from '../layout/placement';
import { nextCardinality } from '../model/cardinality';
import { createId } from '../model/ids';
import * as operations from '../model/operations';
import { findElementName, findRelationship } from '../model/queries';
import type {
  AttributeIdentifier,
  AttributeShape,
  Cardinality,
  Color,
  ComponentTheme,
  EntityKind,
  ErDocument,
  Id,
  Position,
  RelationshipKind,
} from '../model/types';

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
  addRelationshipBetween: (entityIds: readonly Id[], position: Position) => Id;
  rename: (id: Id, name: string) => void;
  setCardinality: (relationshipId: Id, endIndex: number, value: Cardinality | null) => void;
  cycleCardinality: (relationshipId: Id, endIndex: number) => void;
  setEntityKind: (id: Id, kind: EntityKind) => void;
  setRelationshipKind: (id: Id, kind: RelationshipKind) => void;
  setAttributeShape: (id: Id, shape: AttributeShape) => void;
  setAttributeIdentifier: (id: Id, identifier: AttributeIdentifier) => void;
  setAttributeForeignKey: (id: Id, foreignKey: boolean) => void;
  setElementColor: (id: Id, color: Color | null) => void;
  setComponentTheme: (theme: ComponentTheme) => void;
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

      addRelationshipBetween: (entityIds, position) => {
        const id = createId();
        set({
          document: operations.addRelationship(get().document, {
            id,
            name: '',
            entityIds,
            position,
          }),
        });
        return id;
      },

      rename: (id, name) => {
        const document = get().document;
        const current = findElementName(document.model, id);
        // Confirming a rename without changing anything must not fill the undo
        // history. An unknown id means the element was undone away while its
        // input still had focus; the blur that follows is not an error.
        if (current === undefined || current === name) {
          return;
        }
        set({ document: operations.renameElement(document, { id, name }) });
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
        const end = findRelationship(document.model, relationshipId)?.ends[endIndex];
        if (!end) {
          return;
        }
        set({
          document: operations.setCardinality(document, {
            relationshipId,
            endIndex,
            cardinality: nextCardinality(end.cardinality),
          }),
        });
      },

      setEntityKind: (id, kind) => {
        set({ document: operations.setEntityKind(get().document, id, kind) });
      },

      setRelationshipKind: (id, kind) => {
        set({ document: operations.setRelationshipKind(get().document, id, kind) });
      },

      setAttributeShape: (id, shape) => {
        set({ document: operations.setAttributeShape(get().document, id, shape) });
      },

      setAttributeIdentifier: (id, identifier) => {
        set({ document: operations.setAttributeIdentifier(get().document, id, identifier) });
      },

      setAttributeForeignKey: (id, foreignKey) => {
        set({ document: operations.setAttributeForeignKey(get().document, id, foreignKey) });
      },

      setElementColor: (id, color) => {
        set({ document: operations.setElementColor(get().document, id, color) });
      },

      setComponentTheme: (theme) => {
        set({ document: operations.setTheme(get().document, theme) });
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
      // Model operations return the *same* document when nothing changed, so
      // reference equality is enough to keep no-op actions out of the history.
      equality: (past, current) => past.document === current.document,
    },
  ),
);

/**
 * Replaces the document and drops the undo history with it.
 *
 * Opening a different diagram is a boundary, not a step: undoing across it
 * would splice two unrelated documents into one timeline. Used by import and
 * "new diagram" in milestone 7.
 */
export function loadDocument(document: ErDocument): void {
  useDocumentStore.getState().replaceDocument(document);
  useDocumentStore.temporal.getState().clear();
}
