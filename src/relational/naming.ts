/**
 * MySQL identifiers are at most 64 characters, and column names and (on
 * Windows and macOS) table names compare case-insensitively. Names are
 * therefore claimed through a `NameSet`, which truncates and de-duplicates so
 * the export never writes two tables or two columns MySQL would confuse.
 */

export const MAX_IDENTIFIER_LENGTH = 64;

export class NameSet {
  private readonly used = new Set<string>();

  has(name: string): boolean {
    return this.used.has(name.toLowerCase());
  }

  /** Returns `wanted`, or `wanted_2`, `wanted_3`… if it is taken. */
  claim(wanted: string): string {
    const base = wanted.slice(0, MAX_IDENTIFIER_LENGTH);
    let name = base;
    for (let suffix = 2; this.has(name); suffix += 1) {
      const tail = `_${String(suffix)}`;
      name = `${base.slice(0, MAX_IDENTIFIER_LENGTH - tail.length)}${tail}`;
    }
    this.used.add(name.toLowerCase());
    return name;
  }
}
