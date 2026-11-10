import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { messages } from '../../i18n/messages.en';
import { formatMinMax, MIN_MAX_PLACEHOLDER, parseMinMax } from '../../model/minMax';
import { useDocumentStore } from '../../store/documentStore';
import type { CardinalityLabel } from '../scene';

/**
 * The label beside an entity on a relationship end.
 *
 * In the classic notation it is the `1`, `N` or `M`. An undecided end is a
 * dashed `?` placeholder, and clicking cycles `? -> 1 -> N -> M -> 1`
 * (SPEC.md §5).
 *
 * In the min-max notation it is the `(min,max)` pair, and clicking opens a
 * small field to type it in.
 *
 * Either way it only ever changes the end the student clicked. Nothing else in
 * the model moves with it (SPEC.md §1.1).
 */
export interface CardinalityChipProps {
  label: CardinalityLabel;
}

function chipStyle(label: CardinalityLabel): { transform: string } {
  return {
    transform: `translate(-50%, -50%) translate(${label.position.x}px, ${label.position.y}px)`,
  };
}

export function CardinalityChip({ label }: CardinalityChipProps): ReactElement {
  return label.notation === 'min-max' ? (
    <MinMaxChip label={label} />
  ) : (
    <ClassicChip label={label} />
  );
}

function ClassicChip({ label }: CardinalityChipProps): ReactElement {
  const cycleCardinality = useDocumentStore((state) => state.cycleCardinality);
  const unset = label.value === null;

  return (
    <button
      type="button"
      className={unset ? 'chen-cardinality chen-cardinality--unset' : 'chen-cardinality'}
      style={chipStyle(label)}
      onClick={(event) => {
        event.stopPropagation();
        cycleCardinality(label.relationshipId, label.endIndex);
      }}
      title={messages.canvas.cardinalityHint}
      aria-label={
        unset
          ? messages.canvas.cardinalityUnsetLabel
          : messages.canvas.cardinalitySetLabel(label.value ?? '')
      }
    >
      {label.value ?? messages.canvas.cardinalityPlaceholder}
    </button>
  );
}

function MinMaxChip({ label }: CardinalityChipProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const unset = label.minMax === null;

  if (editing) {
    return (
      <MinMaxField
        label={label}
        onDone={() => {
          setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={unset ? 'chen-cardinality chen-cardinality--unset' : 'chen-cardinality'}
      style={chipStyle(label)}
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      title={messages.canvas.minMaxHint}
      aria-label={
        unset
          ? messages.canvas.minMaxUnsetLabel
          : messages.canvas.minMaxSetLabel(formatMinMax(label.minMax))
      }
    >
      {unset ? MIN_MAX_PLACEHOLDER : formatMinMax(label.minMax)}
    </button>
  );
}

interface MinMaxFieldProps extends CardinalityChipProps {
  onDone: () => void;
}

/**
 * Enter confirms and Escape cancels, like renaming. A pair that cannot be read
 * keeps the field open and marked; leaving the field then drops the draft, so
 * a typo never changes the model.
 */
function MinMaxField({ label, onDone }: MinMaxFieldProps): ReactElement {
  const setMinMax = useDocumentStore((state) => state.setMinMax);
  const [draft, setDraft] = useState(label.minMax === null ? '' : formatMinMax(label.minMax));
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Closing removes the focused field, which may fire one last blur; it must
  // not store a draft that Escape just threw away.
  const closed = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const close = (): void => {
    closed.current = true;
    onDone();
  };

  /** True when the draft was stored (or cleared). */
  const commit = (): boolean => {
    const parsed = parseMinMax(draft);
    if (!parsed.ok) {
      setInvalid(true);
      return false;
    }
    setMinMax(label.relationshipId, label.endIndex, parsed.value);
    return true;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Keeps single-key shortcuts and Delete from firing while typing.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (commit()) {
        close();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <input
      ref={inputRef}
      className={invalid ? 'chen-min-max-field chen-min-max-field--invalid' : 'chen-min-max-field'}
      style={chipStyle(label)}
      value={draft}
      placeholder={messages.canvas.minMaxPlaceholder}
      size={7}
      onChange={(event) => {
        setDraft(event.target.value);
        setInvalid(false);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (closed.current) {
          return;
        }
        commit();
        close();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
      aria-label={messages.canvas.minMaxFieldLabel}
      aria-invalid={invalid}
      title={invalid ? messages.canvas.minMaxInvalid : messages.canvas.minMaxHint}
    />
  );
}
