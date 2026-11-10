import type { Cardinality, MinMax, Notation, Participation, Relationship } from './types';

/**
 * `(min,max)` pairs (data modelling lesson 'IS-A Relationships & Min-Max').
 *
 * A pair counts the entity it stands next to: `(1,3)` beside KEEPER says one
 * keeper takes part at least once and at most three times. That is the
 * opposite reading direction from the classic look-across `1`/`N`/`M`, which
 * is why `classicEnds` swaps the two ends of a binary relationship.
 */

/** Drawn for an end whose pair the student has not chosen yet. */
export const MIN_MAX_PLACEHOLDER = '(?,?)';

/** True when `min` and `max` form a pair the course would write. */
export function isValidMinMax(pair: MinMax): boolean {
  if (!Number.isInteger(pair.min) || pair.min < 0) {
    return false;
  }
  if (pair.max === 'n') {
    return true;
  }
  return Number.isInteger(pair.max) && pair.max >= 1 && pair.max >= pair.min;
}

/** `(0,n)`, `(17,36)`, or the placeholder for an undecided end. */
export function formatMinMax(pair: MinMax | null): string {
  if (pair === null) {
    return MIN_MAX_PLACEHOLDER;
  }
  return `(${String(pair.min)},${String(pair.max)})`;
}

/** What the student typed, read as a pair. */
export type MinMaxInput = { ok: true; value: MinMax | null } | { ok: false };

const BOUND = String.raw`(\d+|[nm*])`;
const PAIR_PATTERN = new RegExp(
  String.raw`^\(?\s*${BOUND}\s*(?:,|;|\.\.|\s)\s*${BOUND}\s*\)?$`,
  'i',
);

/**
 * Reads `(0,n)`, `0,n`, `0 n` or `0..n`. `n`, `m` and `*` all mean "no limit",
 * and the pair is stored with `n`. Empty input clears the pair.
 */
export function parseMinMax(text: string): MinMaxInput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  const match = PAIR_PATTERN.exec(trimmed);
  const [, rawMin, rawMax] = match ?? [];
  if (rawMin === undefined || rawMax === undefined || !/^\d+$/.test(rawMin)) {
    return { ok: false };
  }
  const max = /^\d+$/.test(rawMax) ? Number(rawMax) : 'n';
  const pair: MinMax = { min: Number(rawMin), max };
  return isValidMinMax(pair) ? { ok: true, value: pair } : { ok: false };
}

/** What a relationship end means in classic terms. */
export interface ClassicEnd {
  cardinality: Cardinality | null;
  participation: Participation;
}

function cardinalityFromMax(pair: MinMax | null): Cardinality | null {
  if (pair === null) {
    return null;
  }
  return pair.max === 1 ? '1' : 'N';
}

/**
 * The classic cardinality and participation of every end, in end order.
 *
 * In the classic notation that is what the student chose. In the min-max
 * notation it is worked out from the pairs, so the SQL export reads one
 * meaning whatever the diagram shows:
 *
 * - participation is total when `min` is at least 1;
 * - in a binary relationship, an end's look-across cardinality is the OTHER
 *   end's `max`: `(0,n)` beside PUBLISHER means one publisher has many books,
 *   which classic notation writes as `N` on the BOOK end;
 * - with three or more ends, a pair says how often one entity takes part, not
 *   how many partners a combination of the others has, so every decided end
 *   counts as many.
 */
export function classicEnds(relationship: Relationship, notation: Notation): ClassicEnd[] {
  if (notation === 'classic') {
    return relationship.ends.map((end) => ({
      cardinality: end.cardinality,
      participation: end.participation,
    }));
  }

  const binary = relationship.ends.length === 2;
  return relationship.ends.map((end, index) => {
    const participation: Participation =
      end.minMax !== null && end.minMax.min >= 1 ? 'total' : 'partial';
    if (!binary) {
      return { cardinality: end.minMax === null ? null : 'N', participation };
    }
    const other = relationship.ends[1 - index];
    return { cardinality: cardinalityFromMax(other?.minMax ?? null), participation };
  });
}
