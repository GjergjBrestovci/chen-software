import { useEffect } from 'react';

/**
 * Keyboard shortcuts from SPEC.md §5.
 *
 * `Ctrl/Cmd+Z` / `Ctrl+Y` arrive in milestone 4 and `Ctrl/Cmd+S` in milestone 7;
 * they are deliberately absent rather than half-wired.
 */
export interface ShortcutHandlers {
  onNewEntity: () => void;
  onAddAttribute: () => void;
  onToggleRelationshipMode: () => void;
  onDeleteSelection: () => void;
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

      if (isTypingInto(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
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
