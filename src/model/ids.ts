import { nanoid } from 'nanoid';
import type { Id } from './types';

export type IdGenerator = () => Id;

const defaultGenerator: IdGenerator = () => nanoid(10);

let generator: IdGenerator = defaultGenerator;

/** Produces a fresh element id. The only impure function in `model/`. */
export function createId(): Id {
  return generator();
}

/** Swaps in a deterministic generator. Intended for tests. */
export function setIdGenerator(next: IdGenerator): void {
  generator = next;
}

/** Restores the nanoid-backed generator. */
export function resetIdGenerator(): void {
  generator = defaultGenerator;
}

/** Builds a deterministic generator such as `e1, e2, e3, ...` for tests. */
export function sequentialIdGenerator(prefix = 'id'): IdGenerator {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${String(n)}`;
  };
}
