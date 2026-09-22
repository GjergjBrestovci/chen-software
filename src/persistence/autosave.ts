import { del, get, set } from 'idb-keyval';
import type { ErDocument } from '../model/types';
import { readDocument } from './migrations';

/**
 * Autosave to IndexedDB (SPEC.md §9).
 *
 * What comes back is validated and migrated exactly like an imported file. A
 * saved diagram can be weeks old and written by an earlier version, and a
 * half-written or hand-edited record must never load as a broken model.
 */

const AUTOSAVE_KEY = 'chenlab:document';

/** Debounce for autosave writes, in milliseconds. */
export const AUTOSAVE_DELAY_MS = 500;

export async function writeAutosave(document: ErDocument): Promise<void> {
  await set(AUTOSAVE_KEY, document);
}

/**
 * The restored diagram, or `null` when there is nothing to restore or what was
 * stored no longer loads. A broken autosave is dropped rather than surfaced:
 * the student did not ask to open it, so an error about it would be noise.
 */
export async function readAutosave(): Promise<ErDocument | null> {
  const stored: unknown = await get(AUTOSAVE_KEY);
  if (stored === undefined) {
    return null;
  }

  const outcome = readDocument(stored);
  return outcome.ok ? outcome.value.document : null;
}

export async function clearAutosave(): Promise<void> {
  await del(AUTOSAVE_KEY);
}

export interface Debouncer<T> {
  /** Replaces any pending call. */
  schedule: (value: T) => void;
  /** Runs a pending call immediately, if there is one. */
  flush: () => void;
  cancel: () => void;
}

/** Trailing-edge debounce, so a burst of edits writes once. */
export function createDebouncer<T>(run: (value: T) => void, delayMs: number): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | undefined;

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = undefined;
  };

  return {
    schedule: (value) => {
      pending = { value };
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        const next = pending;
        pending = undefined;
        if (next) {
          run(next.value);
        }
      }, delayMs);
    },
    flush: () => {
      const next = pending;
      cancel();
      if (next) {
        run(next.value);
      }
    },
    cancel,
  };
}
