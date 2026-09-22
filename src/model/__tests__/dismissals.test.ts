import { describe, expect, it } from 'vitest';
import { dismissalKey, parseDismissalKey } from '../dismissals';

describe('dismissalKey', () => {
  it('builds a key from a single target', () => {
    expect(dismissalKey('isolated-entity', ['e2'])).toBe('isolated-entity:e2');
  });

  it('sorts targets so end order cannot change the key', () => {
    expect(dismissalKey('duplicate-entity-name', ['e7', 'e3'])).toBe('duplicate-entity-name:e3,e7');
    expect(dismissalKey('duplicate-entity-name', ['e3', 'e7'])).toBe(
      dismissalKey('duplicate-entity-name', ['e7', 'e3']),
    );
  });

  it('does not mutate the caller array', () => {
    const targets = ['e7', 'e3'];
    dismissalKey('r', targets);
    expect(targets).toEqual(['e7', 'e3']);
  });
});

describe('parseDismissalKey', () => {
  it('round-trips a multi-target key', () => {
    const key = dismissalKey('duplicate-entity-name', ['e7', 'e3']);
    expect(parseDismissalKey(key)).toEqual({
      ruleId: 'duplicate-entity-name',
      targetIds: ['e3', 'e7'],
    });
  });

  it.each([
    ['no separator', 'isolated-entity'],
    ['empty rule id', ':e2'],
    ['no targets', 'isolated-entity:'],
    ['empty target in list', 'isolated-entity:e2,'],
    ['empty string', ''],
  ])('rejects a malformed key (%s)', (_label, key) => {
    expect(parseDismissalKey(key)).toBeNull();
  });
});
