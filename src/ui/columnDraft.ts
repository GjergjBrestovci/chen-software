import { messages } from '../i18n/messages.en';
import { SQL_TYPES, takesLength, takesPrecision } from '../model/column';
import type { ColumnSpec, Id, SqlType } from '../model/types';

/**
 * The column panel edits a draft of text fields and applies it as a whole, so
 * one Apply is one undo entry. Numbers stay text while being typed; they are
 * checked only when applied.
 */
export interface ColumnDraft {
  type: SqlType | '';
  length: string;
  precision: string;
  scale: string;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue: string;
  /** Empty when no entity is chosen. */
  references: Id;
}

export type DraftOutcome = { ok: true; spec: ColumnSpec } | { ok: false; message: string };

function numberText(value: number | null): string {
  return value === null ? '' : String(value);
}

export function toDraft(spec: ColumnSpec): ColumnDraft {
  return {
    type: spec.type ?? '',
    length: numberText(spec.length),
    precision: numberText(spec.precision),
    scale: numberText(spec.scale),
    notNull: spec.notNull,
    unique: spec.unique,
    autoIncrement: spec.autoIncrement,
    defaultValue: spec.defaultValue ?? '',
    references: spec.references ?? '',
  };
}

export function isSqlType(value: string): value is SqlType {
  return (SQL_TYPES as readonly string[]).includes(value);
}

interface CountField {
  field: 'length' | 'precision' | 'scale';
  minimum: number;
  label: string;
}

/** `undefined` when the text is not a whole number of at least `minimum`. */
function parseCount(value: string, minimum: number): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return parsed >= minimum ? parsed : undefined;
}

/**
 * Turns a draft back into column details. Fields the chosen type does not use
 * keep their previous values, since the panel did not show them.
 */
export function fromDraft(draft: ColumnDraft, previous: ColumnSpec): DraftOutcome {
  const type = draft.type === '' ? null : draft.type;
  const spec: ColumnSpec = {
    ...previous,
    type,
    notNull: draft.notNull,
    unique: draft.unique,
    autoIncrement: draft.autoIncrement,
    defaultValue: draft.defaultValue.length > 0 ? draft.defaultValue : null,
    references: draft.references === '' ? null : draft.references,
  };

  const counts: CountField[] = [];
  if (type !== null && takesLength(type)) {
    counts.push({ field: 'length', minimum: 1, label: messages.column.length });
  }
  if (type !== null && takesPrecision(type)) {
    counts.push({ field: 'precision', minimum: 1, label: messages.column.precision });
    counts.push({ field: 'scale', minimum: 0, label: messages.column.scale });
  }

  for (const { field, minimum, label } of counts) {
    const parsed = parseCount(draft[field], minimum);
    if (parsed === undefined) {
      return { ok: false, message: messages.column.wholeNumber(label, minimum) };
    }
    spec[field] = parsed;
  }
  return { ok: true, spec };
}
