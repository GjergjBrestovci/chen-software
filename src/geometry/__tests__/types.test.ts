import { describe, expect, it } from 'vitest';
import { boundsOf, boxFromTopLeft, topLeftOf, unionBounds } from '../types';
import type { ShapeBox } from '../types';

const box: ShapeBox = { kind: 'rect', center: { x: 100, y: 50 }, size: { width: 40, height: 20 } };

describe('box helpers', () => {
  it('converts a React Flow top-left position into a centred box', () => {
    expect(boxFromTopLeft('rect', { x: 80, y: 40 }, { width: 40, height: 20 })).toEqual(box);
  });

  it('round-trips back to the top-left corner', () => {
    expect(topLeftOf(boxFromTopLeft('rect', { x: 80, y: 40 }, { width: 40, height: 20 }))).toEqual({
      x: 80,
      y: 40,
    });
  });

  it('reports bounds', () => {
    expect(boundsOf(box)).toEqual({ minX: 80, minY: 40, maxX: 120, maxY: 60 });
  });

  it('unions several bounds', () => {
    const other: ShapeBox = {
      kind: 'ellipse',
      center: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
    };
    expect(unionBounds([boundsOf(box), boundsOf(other)])).toEqual({
      minX: -5,
      minY: -5,
      maxX: 120,
      maxY: 60,
    });
  });

  it('unions a single bounds to itself', () => {
    expect(unionBounds([boundsOf(box)])).toEqual(boundsOf(box));
  });

  it('has no union for an empty diagram', () => {
    expect(unionBounds([])).toBeNull();
  });
});
