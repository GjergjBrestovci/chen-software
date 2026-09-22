import { useEffect } from 'react';

/** Keyboard shortcuts from SPEC.md §5. */
export interface ShortcutHandlers {
  onNewEntity: () => void;
  onAddAttribute: () => void;
  onToggleRelationshipMode: () => void;
  onDeleteSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onEscape: () => void;
}

/** True while the student is typing, so single-key shortcuts must not fire. */
function isTypingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        handlers.onEscape();
        return;
      }

      // While a name is being typed, Ctrl+Z belongs to the text field: the
      // student is undoing their typing, not their last diagram change.
      if (isTypingInto(event.target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 's') {
          // The browser would otherwise offer to save the page itself.
          event.preventDefault();
          handlers.onSave();
        } else if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handlers.onUndo();
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          handlers.onRedo();
        }
        return;
      }

      if (event.altKey) {
        return;
      }

      switch (event.key) {
        case 'e':
        case 'E':
          event.preventDefault();
          handlers.onNewEntity();
          break;
        case 'a':
        case 'A':
          event.preventDefault();
          handlers.onAddAttribute();
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          handlers.onToggleRelationshipMode();
          break;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          handlers.onDeleteSelection();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handlers]);
}
