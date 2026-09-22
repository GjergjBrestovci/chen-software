import { useEffect, useRef, useState } from 'react';
import { loadDocument, useDocumentStore } from './documentStore';
import type { ErDocument } from '../model/types';
import {
  AUTOSAVE_DELAY_MS,
  createDebouncer,
  readAutosave,
  writeAutosave,
} from '../persistence/autosave';

/**
 * Keeps IndexedDB in step with the document (SPEC.md §9).
 *
 * Writes are debounced, so a drag or a burst of typing costs one write, and
 * flushed when the page is hidden, so closing the tab straight after an edit
 * does not lose it.
 */
export function useAutosave(enabled = true): void {
  const savedRef = useRef<ErDocument | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const debouncer = createDebouncer<ErDocument>((document) => {
      savedRef.current = document;
      void writeAutosave(document);
    }, AUTOSAVE_DELAY_MS);

    const unsubscribe = useDocumentStore.subscribe((state) => {
      if (state.document !== savedRef.current) {
        debouncer.schedule(state.document);
      }
    });

    const onHidden = (): void => {
      if (globalThis.document.visibilityState === 'hidden') {
        debouncer.flush();
      }
    };
    globalThis.document.addEventListener('visibilitychange', onHidden);

    return () => {
      debouncer.flush();
      unsubscribe();
      globalThis.document.removeEventListener('visibilitychange', onHidden);
    };
  }, [enabled]);
}

/**
 * Restores the autosaved diagram once, on first render (SPEC.md §9).
 *
 * Restoring replaces the document, so it clears the undo history with it: the
 * steps that produced the saved diagram happened in another session and are
 * not the student's to walk back through here.
 *
 * Returns whether the attempt has finished, so autosaving can wait and not
 * immediately overwrite the very thing it is restoring.
 */
export function useRestoreAutosave(enabled = true): boolean {
  const [restored, setRestored] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    void readAutosave()
      .then((document) => {
        if (!cancelled && document) {
          loadDocument(document);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestored(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return restored;
}
