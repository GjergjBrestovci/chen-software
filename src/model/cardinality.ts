import type { Cardinality } from './types';

/**
 * Next value when the student clicks a cardinality label (SPEC.md §5):
 * `? -> 1 -> N -> M -> 1`.
 *
 * The cycle never returns to `?`, so a click can never undo the student's
 * decision by accident. Clearing it back to undecided is possible, but only
 * through the Inspector, which offers it explicitly.
 */
export function nextCardinality(current: Cardinality | null): Cardinality {
  switch (current) {
    case null:
    case 'M':
      return '1';
    case '1':
      return 'N';
    case 'N':
      return 'M';
  }
}
