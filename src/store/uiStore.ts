import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Id } from '../model/types';

/**
 * Canvas state that is not part of the document: what is selected, what is
 * being renamed, whether relationship mode is armed, and the snap toggle.
 *
 * Deliberately separate from `documentStore`, for two reasons: none of it
 * belongs in an `.erd.json` file, and none of it should land in the undo
 * history (SPEC.md §5 wants one entry per *model* change, not per click).
 */
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
  /** Transient message shown to the student, e.g. why an action did nothing. */
  notice: string | null;

  setSelectedIds: (ids: readonly Id[]) => void;
  startRenaming: (id: Id) => void;
  stopRenaming: () => void;
  toggleRelationshipMode: () => void;
  armRelationshipFrom: (entityId: Id) => void;
  cancelRelationshipMode: () => void;
  toggleSnapToGrid: () => void;
  notify: (message: string) => void;
  dismissNotice: () => void;
}

const IDLE: RelationshipMode = { active: false, firstEntityId: null };

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
      // Only the preference survives a reload; everything else is per-session.
      partialize: (state) => ({ snapToGrid: state.snapToGrid }),
    },
  ),
);
