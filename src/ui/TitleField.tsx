import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import { useDocumentStore } from '../store/documentStore';

/**
 * The diagram's title, editable in place. It names both saved files and heads
 * the PDF, so a student no longer ends up with every save called
 * `untitled-diagram`.
 *
 * Enter or leaving the field confirms; Escape puts the old title back.
 */
function TitleInput({ title }: { title: string }): ReactElement {
  const setTitle = useDocumentStore((state) => state.setTitle);
  const [draft, setDraft] = useState(title);
  // Escape blurs the field, and the blur fires before React has applied the
  // reset, so it would read the abandoned text and commit it. This marks the
  // blur as a cancellation instead.
  const cancelling = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Typing a title must never trigger the canvas shortcuts.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      cancelling.current = true;
      setDraft(title);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      className="chen-title-field"
      value={draft}
      placeholder={messages.document.untitled}
      aria-label={messages.file.title}
      title={messages.file.title}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (cancelling.current) {
          cancelling.current = false;
          return;
        }
        setTitle(event.target.value.trim());
      }}
    />
  );
}

export function TitleField(): ReactElement {
  const title = useDocumentStore((state) => state.document.title);
  // Remounting on a new title resyncs the field after undo, Open or New.
  return <TitleInput key={title} title={title} />;
}
