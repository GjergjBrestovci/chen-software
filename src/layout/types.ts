import type { ElementKind } from '../model/types';
import type { ShapeKind } from '../geometry';

/** Which outline each kind of element is drawn with (SPEC.md §5). */
export function shapeKindFor(kind: ElementKind): ShapeKind {
  switch (kind) {
    case 'entity':
      return 'rect';
    case 'relationship':
      return 'diamond';
    case 'attribute':
      return 'ellipse';
  }
}

/** Grid spacing for the graph-paper background and snap-to-grid. */
export const GRID_SIZE = 20;

export function snapToGrid(value: number, grid: number = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}
