import { describe, expect, it } from 'vitest';
import { fromDraft, isSqlType, toDraft } from '../columnDraft';
import { messages } from '../../i18n/messages.en';
import { createColumnSpec } from '../../model/column';
import type { ColumnSpec } from '../../model/types';

const text = messages.column;

function spec(changes: Partial<ColumnSpec> = {}): ColumnSpec {
  return { ...createColumnSpec(), ...changes };
}

describe('column drafts', () => {
  it('round-trip column details unchanged', () => {
    const original = spec({
      type: 'DECIMAL',
      precision: 8,
      scale: 0,
      notNull: true,
      defaultValue: '1.5',
      references: 'e',
    });
    expect(fromDraft(toDraft(original), original)).toEqual({ ok: true, spec: original });
  });

  it('show nothing chosen as empty fields', () => {
    expect(toDraft(createColumnSpec())).toMatchObject({
      type: '',
      length: '',
      defaultValue: '',
      references: '',
    });
  });

  it('turn empty fields back into nothing chosen', () => {
    const outcome = fromDraft(
      { ...toDraft(spec({ type: 'VARCHAR', length: 9 })), type: 'VARCHAR', length: ' ' },
      spec(),
    );
    expect(outcome).toEqual({ ok: true, spec: spec({ type: 'VARCHAR' }) });
  });

  it('keep the numbers a type does not use, since they were not shown', () => {
    const previous = spec({ type: 'VARCHAR', length: 40, precision: 6 });
    const outcome = fromDraft({ ...toDraft(previous), type: 'INT', length: 'junk' }, previous);
    expect(outcome).toEqual({ ok: true, spec: { ...previous, type: 'INT' } });
  });

  it.each([
    ['CHAR', 'length', '0', text.length, 1],
    ['VARCHAR', 'length', '-3', text.length, 1],
    ['DECIMAL', 'precision', '1.5', text.precision, 1],
    ['DECIMAL', 'scale', 'two', text.scale, 0],
  ] as const)('refuse %s with %s %j', (type, field, value, label, minimum) => {
    const outcome = fromDraft({ ...toDraft(spec()), type, [field]: value }, spec());
    expect(outcome).toEqual({ ok: false, message: text.wholeNumber(label, minimum) });
  });

  it('accept a scale of zero', () => {
    const outcome = fromDraft(
      { ...toDraft(spec()), type: 'DECIMAL', precision: '5', scale: '0' },
      spec(),
    );
    expect(outcome).toEqual({ ok: true, spec: spec({ type: 'DECIMAL', precision: 5, scale: 0 }) });
  });

  it('recognise only the MySQL types on offer', () => {
    expect(isSqlType('VARCHAR')).toBe(true);
    expect(isSqlType('varchar')).toBe(false);
    expect(isSqlType('')).toBe(false);
  });
});
