import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import { useUiStore } from '../store/uiStore';

const DISMISS_AFTER_MS = 4000;

/**
 * Explains why an action did nothing, e.g. picking the same entity twice for a
 * relationship. It reports, it never fixes anything for the student.
 */
export function Notice(): ReactElement | null {
  const notice = useUiStore((state) => state.notice);
  const dismissNotice = useUiStore((state) => state.dismissNotice);

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = setTimeout(dismissNotice, DISMISS_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, dismissNotice]);

  if (notice === null) {
    return null;
  }

  return (
    <div className="chen-notice" role="status">
      <span>{notice}</span>
      <button type="button" onClick={dismissNotice} aria-label={messages.notice.dismiss}>
        ×
      </button>
    </div>
  );
}
