import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';

/**
 * Inline rename (SPEC.md §5): Enter confirms, Escape cancels.
 *
 * Escape leaves the element exactly as it was, including an element that has
 * just been created and is still unnamed. It never deletes anything: the app
 * does not remove the student's work on its own (SPEC.md §1.1), and an empty
 * name is allowed and flagged by the validator instead.
 */
export interface InlineNameProps {
  value: string;
  fontSize: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export function InlineName({ value, fontSize, onCommit, onCancel }: InlineNameProps): ReactElement {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Keeps single-key shortcuts and Delete from firing while typing.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit(draft);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="chen-inline-name"
      style={{ fontSize }}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        onCommit(draft);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
      aria-label="Name"
    />
  );
}
