import { z } from 'zod';
import { messages } from '../i18n/messages.en';
import { createPresentation } from '../model/presentation';
import { CURRENT_VERSION, parseErDocument, versionOf } from '../model/schema';
import type { ParseOutcome } from '../model/schema';
import type { ErDocument } from '../model/types';

/**
 * Upgrades older `.erd.json` files to the current format (SPEC.md §8).
 *
 * Each version is validated against its own schema *before* being transformed,
 * so a damaged old file is rejected as damaged rather than being half-migrated
 * into something that then fails the current schema with a confusing message.
 */

const idSchema = z.string().min(1);
const positionSchema = z.strictObject({ x: z.number(), y: z.number() });

/**
 * Version 1: flat attribute `kind`, binary-only `ends`, no entity or
 * relationship kinds, no participation, no roles, no presentation.
 */
const erDocumentV1Schema = z.strictObject({
  version: z.literal(1),
  title: z.string(),
  model: z.strictObject({
    entities: z.array(z.strictObject({ id: idSchema, name: z.string() })),
    attributes: z.array(
      z.strictObject({
        id: idSchema,
        ownerId: idSchema,
        ownerKind: z.enum(['entity', 'relationship']),
        name: z.string(),
        kind: z.enum(['simple', 'key']),
      }),
    ),
    relationships: z.array(
      z.strictObject({
        id: idSchema,
        name: z.string(),
        ends: z.tuple([
          z.strictObject({ entityId: idSchema, cardinality: z.enum(['1', 'N', 'M']).nullable() }),
          z.strictObject({ entityId: idSchema, cardinality: z.enum(['1', 'N', 'M']).nullable() }),
        ]),
      }),
    ),
  }),
  layout: z.strictObject({ positions: z.record(z.string(), positionSchema) }),
  dismissedHints: z.array(z.string()),
});

type ErDocumentV1 = z.infer<typeof erDocumentV1Schema>;

/**
 * Version 1 to 2.
 *
 * Everything new takes the value that leaves the diagram looking and behaving
 * exactly as it did: entities and relationships are regular, every attribute is
 * a simple non-foreign-key, participation is partial, no roles, and the default
 * theme is the ink the app already drew in. A version 1 file therefore survives
 * the upgrade with no visible change.
 */
function migrateV1ToV2(document: ErDocumentV1): ErDocument {
  return {
    version: 2,
    title: document.title,
    model: {
      entities: document.model.entities.map((entity) => ({ ...entity, kind: 'regular' })),
      attributes: document.model.attributes.map((attribute) => ({
        id: attribute.id,
        ownerId: attribute.ownerId,
        ownerKind: attribute.ownerKind,
        name: attribute.name,
        shape: 'simple',
        identifier: attribute.kind === 'key' ? 'key' : 'none',
        foreignKey: false,
      })),
      relationships: document.model.relationships.map((relationship) => ({
        id: relationship.id,
        name: relationship.name,
        kind: 'regular',
        ends: relationship.ends.map((end) => ({
          entityId: end.entityId,
          cardinality: end.cardinality,
          participation: 'partial',
          role: null,
        })),
      })),
    },
    layout: { positions: { ...document.layout.positions } },
    presentation: createPresentation(),
    dismissedHints: [...document.dismissedHints],
  };
}

export type MigrationOutcome = { ok: true; value: unknown } | { ok: false; message: string };

/** Brings any supported file version up to the current one. */
export function migrateToCurrent(input: unknown): MigrationOutcome {
  const version = versionOf(input);

  if (version === null || version === CURRENT_VERSION) {
    // Nothing to do; `parseErDocument` reports anything actually wrong.
    return { ok: true, value: input };
  }

  if (version === 1) {
    const parsed = erDocumentV1Schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: messages.file.invalid };
    }
    return { ok: true, value: migrateV1ToV2(parsed.data) };
  }

  return { ok: false, message: messages.file.unsupportedVersion(version) };
}

/** Migrates, then validates. The entry point every import path should use. */
export function readDocument(input: unknown): ParseOutcome {
  const migrated = migrateToCurrent(input);
  if (!migrated.ok) {
    return { ok: false, message: migrated.message };
  }
  return parseErDocument(migrated.value);
}

/** Migrates, then validates, raw `.erd.json` text. */
export function readDocumentJson(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: messages.file.notJson };
  }
  return readDocument(parsed);
}
