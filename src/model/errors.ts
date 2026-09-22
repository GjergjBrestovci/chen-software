/**
 * Thrown when a model operation is called with input that cannot be applied,
 * such as an unknown id or a key attribute on a relationship.
 *
 * These are programmer errors: the UI guards against them before calling, so a
 * student never sees one. That is why the text here is English-only and does
 * not live in `i18n/` (SPEC.md §10 covers user-facing strings).
 */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}
