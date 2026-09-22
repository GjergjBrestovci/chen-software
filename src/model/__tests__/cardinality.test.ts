import { describe, expect, it } from 'vitest';
import { nextCardinality } from '../cardinality';

describe('nextCardinality', () => {
  it('cycles ? -> 1 -> N -> M -> 1 as SPEC.md §5 describes', () => {
    expect(nextCardinality(null)).toBe('1');
    expect(nextCardinality('1')).toBe('N');
    expect(nextCardinality('N')).toBe('M');
    expect(nextCardinality('M')).toBe('1');
  });

  it('never returns to undecided, so a click cannot undo a choice by accident', () => {
    let value = nextCardinality(null);
    for (let step = 0; step < 20; step += 1) {
      value = nextCardinality(value);
      expect(value).not.toBeNull();
    }
  });
});
