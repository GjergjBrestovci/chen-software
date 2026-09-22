import { readFileSync } from 'node:fs';

/** Reads one of the `fixtures/*.erd.json` files as raw text. */
export function readFixture(name: string): string {
  return readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8');
}
