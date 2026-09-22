import type { Id } from './types';

/**
 * Builds the key used in `ErDocument.dismissedHints`.
 *
 * SPEC.md §4 shows `${ruleId}:${targetId}`, but §7 gives a hint several
 * targets. Per the project ruling this joins every target id, sorted, so a
 * dismissal applies to one specific hint *instance*: if the student later
 * renames one of two duplicate entities, the pair changes, the key changes,
 * and the hint reappears.
 */
export function dismissalKey(ruleId: string, targetIds: readonly Id[]): string {
  return `${ruleId}:${[...targetIds].sort().join(',')}`;
}

export interface ParsedDismissal {
  ruleId: string;
  targetIds: Id[];
}

/** Inverse of `dismissalKey`. Returns `null` for keys that are not well formed. */
export function parseDismissalKey(key: string): ParsedDismissal | null {
  const separator = key.indexOf(':');
  if (separator <= 0) {
    return null;
  }

  const ruleId = key.slice(0, separator);
  const joinedTargets = key.slice(separator + 1);
  if (joinedTargets.length === 0) {
    return null;
  }

  const targetIds = joinedTargets.split(',');
  if (targetIds.some((id) => id.length === 0)) {
    return null;
  }

  return { ruleId, targetIds };
}
