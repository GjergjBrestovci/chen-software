import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import { useUiStore } from '../store/uiStore';

/**
 * Asked before something the student cannot undo, such as discarding an
 * unsaved diagram (SPEC.md §9). Cancel is focused first, so the safe answer is
 * the one a stray Enter gives.
 */
export function ConfirmDialog(): ReactElement | null {
  const confirmation = useUiStore((state) => state.confirmation);
  const dismiss = useUiStore((state) => state.dismissConfirmation);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmation) {
      cancelRef.current?.focus();
    }
  }, [confirmation]);

  if (!confirmation) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
  };

  return (
    <div className="chen-dialog-backdrop" onKeyDown={onKeyDown}>
      <div
        className="chen-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={messages.dialog.label}
      >
        <p>{confirmation.message}</p>
        <div className="chen-dialog-actions">
          <button type="button" ref={cancelRef} onClick={dismiss}>
            {messages.dialog.cancel}
          </button>
          <button
            type="button"
            className="chen-dialog-danger"
            onClick={() => {
              dismiss();
              confirmation.onConfirm();
            }}
          >
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
