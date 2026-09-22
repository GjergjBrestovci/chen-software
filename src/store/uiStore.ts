import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { ErDocument, Id } from '../model/types';

/**
 * Canvas state that is not part of the document: what is selected, what is
 * being renamed, whether relationship mode is armed, and the snap toggle.
 *
 * Deliberately separate from `documentStore`, for two reasons: none of it
 * belongs in an `.erd.json` file, and none of it should land in the undo
 * history (SPEC.md §5 wants one entry per *model* change, not per click).
 */
export type Theme = 'light' | 'dark';

/** Which component the context menu is open on, and where it was opened. */
export interface ContextMenuState {
  elementId: Id;
  x: number;
  y: number;
}

/** A question the student has to answer before something irreversible happens. */
export interface Confirmation {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export interface RelationshipMode {
  active: boolean;
  /** First entity picked, waiting for the second. */
  firstEntityId: Id | null;
}

export interface UiStore {
  selectedIds: Id[];
  renamingId: Id | null;
  relationshipMode: RelationshipMode;
  snapToGrid: boolean;
  theme: Theme;
  contextMenu: ContextMenuState | null;
  confirmation: Confirmation | null;
  /**
   * The document as it was when last written to a file. Compared by reference,
   * which works because every model operation returns a new document and a
   * no-op returns the same one. `null` means nothing has been exported yet.
   */
  exportedDocument: ErDocument | null;
  /** Transient message shown to the student, e.g. why an action did nothing. */
  notice: string | null;

  setSelectedIds: (ids: readonly Id[]) => void;
  startRenaming: (id: Id) => void;
  stopRenaming: () => void;
  toggleRelationshipMode: () => void;
  armRelationshipFrom: (entityId: Id) => void;
  cancelRelationshipMode: () => void;
  toggleSnapToGrid: () => void;
  toggleTheme: () => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  ask: (confirmation: Confirmation) => void;
  dismissConfirmation: () => void;
  markExported: (document: ErDocument) => void;
  notify: (message: string) => void;
  dismissNotice: () => void;
}

const IDLE: RelationshipMode = { active: false, firstEntityId: null };

/**
 * First run follows the operating system; after that the student's choice wins.
 * Guarded by `typeof` because the store is also constructed in node tests,
 * where `matchMedia` does not exist.
 */
function preferredTheme(): Theme {
  if (typeof globalThis.matchMedia !== 'function') {
    return 'light';
  }
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Web storage is absent in tests and unavailable in a locked-down browser, so
 * the preference degrades to "remembered for this session only" rather than
 * erroring on every keystroke.
 */
const memoryStorage: StateStorage = (() => {
  const entries = new Map<string, string>();
  return {
    getItem: (name) => entries.get(name) ?? null,
    setItem: (name, value) => {
      entries.set(name, value);
    },
    removeItem: (name) => {
      entries.delete(name);
    },
  };
})();

const safeStorage = createJSONStorage(() =>
  typeof globalThis.localStorage === 'undefined' ? memoryStorage : globalThis.localStorage,
);

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      selectedIds: [],
      renamingId: null,
      relationshipMode: IDLE,
      snapToGrid: true,
      theme: preferredTheme(),
      contextMenu: null,
      confirmation: null,
      exportedDocument: null,
      notice: null,

      setSelectedIds: (ids) => {
        set({ selectedIds: [...ids] });
      },
      startRenaming: (id) => {
        set({ renamingId: id });
      },
      stopRenaming: () => {
        set({ renamingId: null });
      },
      toggleRelationshipMode: () => {
        set((state) => ({
          relationshipMode: state.relationshipMode.active
            ? IDLE
            : { active: true, firstEntityId: null },
        }));
      },
      armRelationshipFrom: (entityId) => {
        set({ relationshipMode: { active: true, firstEntityId: entityId } });
      },
      cancelRelationshipMode: () => {
        set({ relationshipMode: IDLE });
      },
      toggleSnapToGrid: () => {
        set((state) => ({ snapToGrid: !state.snapToGrid }));
      },
      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
      },
      openContextMenu: (menu) => {
        set({ contextMenu: menu });
      },
      closeContextMenu: () => {
        set({ contextMenu: null });
      },
      ask: (confirmation) => {
        set({ confirmation });
      },
      dismissConfirmation: () => {
        set({ confirmation: null });
      },
      markExported: (document) => {
        set({ exportedDocument: document });
      },
      notify: (message) => {
        set({ notice: message });
      },
      dismissNotice: () => {
        set({ notice: null });
      },
    }),
    {
      name: 'chenlab-ui',
      storage: safeStorage,
      // Only preferences survive a reload; everything else is per-session.
      // The theme is a per-viewer preference, never part of the document, so a
      // shared diagram renders correctly for whoever opens it (SPEC.md §4).
      partialize: (state) => ({ snapToGrid: state.snapToGrid, theme: state.theme }),
    },
  ),
);
