import { describe, expect, it } from 'vitest';
import {
  add,
  distance,
  isZero,
  length,
  midpoint,
  normalize,
  perpendicular,
  scale,
  subtract,
} from '../vectors';

describe('vectors', () => {
  it('adds, subtracts and scales', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(subtract({ x: 3, y: 4 }, { x: 1, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });

  it('measures length and distance', () => {
    expect(length({ x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 0, y: 0 }, { x: -3, y: -4 })).toBe(5);
  });

  it('finds a midpoint', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });

  it('normalises to unit length', () => {
    expect(length(normalize({ x: 3, y: 4 }))).toBeCloseTo(1, 12);
  });

  it('normalises a zero vector to zero instead of NaN', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('recognises a zero vector', () => {
    expect(isZero({ x: 0, y: 0 })).toBe(true);
    expect(isZero({ x: 1e-12, y: 0 })).toBe(true);
    expect(isZero({ x: 0.001, y: 0 })).toBe(false);
  });

  it('rotates a quarter turn, preserving length', () => {
    // Compared component-wise: rotating an axis-aligned vector yields a signed
    // zero, and -0 is not `toEqual` 0.
    const fromRight = perpendicular({ x: 1, y: 0 });
    expect(fromRight.x).toBeCloseTo(0, 12);
    expect(fromRight.y).toBe(-1);

    const fromDown = perpendicular({ x: 0, y: 1 });
    expect(fromDown.x).toBe(1);
    expect(fromDown.y).toBeCloseTo(0, 12);

    expect(length(perpendicular({ x: 3, y: 4 }))).toBe(5);
  });
});
