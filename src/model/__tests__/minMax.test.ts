import { describe, expect, it } from 'vitest';
import { classicEnds, formatMinMax, isValidMinMax, parseMinMax } from '../minMax';
import type { MinMax, Relationship } from '../types';

function relationship(...pairs: (MinMax | null)[]): Relationship {
  return {
    id: 'r',
    name: 'r',
    kind: 'regular',
    ends: pairs.map((minMax, index) => ({
      entityId: `e${String(index)}`,
      cardinality: '1',
      participation: 'partial',
      minMax,
      role: null,
    })),
  };
}

describe('isValidMinMax', () => {
  it('accepts the pairs the course writes', () => {
    for (const pair of [
      { min: 0, max: 1 },
      { min: 1, max: 1 },
      { min: 0, max: 'n' },
      { min: 1, max: 'n' },
      { min: 17, max: 36 },
      { min: 2, max: 'n' },
    ] as const) {
      expect(isValidMinMax(pair)).toBe(true);
    }
  });

  it('rejects a max below min, a max of 0, and negative or fractional bounds', () => {
    for (const pair of [
      { min: 3, max: 1 },
      { min: 0, max: 0 },
      { min: -1, max: 'n' },
      { min: 0.5, max: 2 },
      { min: 0, max: 2.5 },
    ] as const) {
      expect(isValidMinMax(pair)).toBe(false);
    }
  });
});

describe('formatMinMax', () => {
  it('writes the pair without spaces, as the course does', () => {
    expect(formatMinMax({ min: 0, max: 'n' })).toBe('(0,n)');
    expect(formatMinMax({ min: 17, max: 36 })).toBe('(17,36)');
  });

  it('writes a placeholder for an undecided end', () => {
    expect(formatMinMax(null)).toBe('(?,?)');
  });
});

describe('parseMinMax', () => {
  it.each([
    ['(0,n)', { min: 0, max: 'n' }],
    ['0,n', { min: 0, max: 'n' }],
    [' ( 1 , 3 ) ', { min: 1, max: 3 }],
    ['1 3', { min: 1, max: 3 }],
    ['2..5', { min: 2, max: 5 }],
    ['0;1', { min: 0, max: 1 }],
    ['1,N', { min: 1, max: 'n' }],
    ['0,m', { min: 0, max: 'n' }],
    ['0,*', { min: 0, max: 'n' }],
  ])('reads %j', (input, expected) => {
    expect(parseMinMax(input)).toEqual({ ok: true, value: expected });
  });

  it('reads empty input as clearing the pair', () => {
    expect(parseMinMax('   ')).toEqual({ ok: true, value: null });
  });

  it.each(['n,1', '3,1', '0,0', '1', 'one,two', '(1,2,3)', '-1,2', '1.5,2'])(
    'refuses %j',
    (input) => {
      expect(parseMinMax(input).ok).toBe(false);
    },
  );
});

describe('classicEnds', () => {
  it('returns the chosen values unchanged in the classic notation', () => {
    expect(classicEnds(relationship(null, null), 'classic')).toEqual([
      { cardinality: '1', participation: 'partial' },
      { cardinality: '1', participation: 'partial' },
    ]);
  });

  it('reads a binary pair look-across: (0,n) beside one side puts N on the other', () => {
    // CUSTOMER (0,n) — places — (1,1) ORDER: one customer, many orders.
    const ends = classicEnds(relationship({ min: 0, max: 'n' }, { min: 1, max: 1 }), 'min-max');
    expect(ends).toEqual([
      { cardinality: '1', participation: 'partial' },
      { cardinality: 'N', participation: 'total' },
    ]);
  });

  it('counts any max above 1 as many', () => {
    const ends = classicEnds(relationship({ min: 17, max: 36 }, { min: 1, max: 1 }), 'min-max');
    expect(ends.map((end) => end.cardinality)).toEqual(['1', 'N']);
    expect(ends.map((end) => end.participation)).toEqual(['total', 'total']);
  });

  it('leaves the cardinality undecided when the pair across is undecided', () => {
    const ends = classicEnds(relationship({ min: 1, max: 1 }, null), 'min-max');
    expect(ends).toEqual([
      { cardinality: null, participation: 'total' },
      { cardinality: '1', participation: 'partial' },
    ]);
  });

  it('counts every decided end of a ternary relationship as many', () => {
    const ends = classicEnds(
      relationship({ min: 1, max: 1 }, { min: 0, max: 'n' }, null),
      'min-max',
    );
    expect(ends).toEqual([
      { cardinality: 'N', participation: 'total' },
      { cardinality: 'N', participation: 'partial' },
      { cardinality: null, participation: 'partial' },
    ]);
  });
});
