import { z } from 'zod';
import { messages } from '../i18n/messages.en';
import { allElementIds, rootOwnerOf } from './queries';
import type { ErDocument, Id } from './types';

/**
 * File-format validation for `.erd.json` (SPEC.md §8).
 *
 * zod checks the shape; `checkIntegrity` checks the things a shape cannot
 * express (dangling references, duplicate ids, composite cycles). Per the
 * project ruling:
 *
 * - semantic damage rejects the WHOLE file, never a partial load;
 * - a missing `layout.positions` entry is NOT damage. Layout cannot affect
 *   correctness, so those ids are reported back and the import layer places
 *   them. Dropping the element instead would mean the app edits the student's
 *   model, which SPEC.md §1 forbids.
 *
 * Self-relationships are valid from version 2 onwards.
 */

const idSchema = z.string().min(1);

// zod v4's `z.number()` already rejects NaN and Infinity.
const positionSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'expected a #rrggbb colour' });

const entitySchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  kind: z.enum(['regular', 'weak']),
});

const attributeSchema = z.strictObject({
  id: idSchema,
  ownerId: idSchema,
  ownerKind: z.enum(['entity', 'relationship', 'attribute']),
  name: z.string(),
  shape: z.enum(['simple', 'composite', 'multivalued', 'derived']),
  identifier: z.enum(['none', 'key', 'partial']),
  foreignKey: z.boolean(),
});

const relationshipEndSchema = z.strictObject({
  entityId: idSchema,
  cardinality: z.enum(['1', 'N', 'M']).nullable(),
  participation: z.enum(['partial', 'total']),
  role: z.string().nullable(),
});

const relationshipSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  kind: z.enum(['regular', 'identifying']),
  ends: z.array(relationshipEndSchema).min(2),
});

const erModelSchema = z.strictObject({
  entities: z.array(entitySchema),
  attributes: z.array(attributeSchema),
  relationships: z.array(relationshipSchema),
});

const layoutSchema = z.strictObject({
  positions: z.record(z.string(), positionSchema),
});

const presentationSchema = z.strictObject({
  theme: z.strictObject({
    entity: colorSchema,
    relationship: colorSchema,
    attribute: colorSchema,
  }),
  colors: z.record(z.string(), colorSchema),
});

export const erDocumentSchema = z.strictObject({
  version: z.literal(2),
  title: z.string(),
  model: erModelSchema,
  layout: layoutSchema,
  presentation: presentationSchema,
  dismissedHints: z.array(z.string()),
});

/** The format version this build writes, and reads without migration. */
export const CURRENT_VERSION = 2;

const versionProbeSchema = z.object({ version: z.number() });

/** Version carried by a file, or `null` if it has none we can read. */
export function versionOf(input: unknown): number | null {
  const probe = versionProbeSchema.safeParse(input);
  return probe.success ? probe.data.version : null;
}

/** Name to quote back to the student, since an element may legitimately be unnamed. */
function describe(name: string): string {
  const trimmed = name.trim();
  return trimmed.length === 0 ? messages.element.unnamed : `"${trimmed}"`;
}

/**
 * Checks references the schema cannot. Returns the first problem as a
 * student-facing message, or `null` when the document is sound.
 */
function checkIntegrity(document: ErDocument): string | null {
  const seen = new Set<Id>();
  for (const id of allElementIds(document.model)) {
    if (seen.has(id)) {
      return messages.file.duplicateId(id);
    }
    seen.add(id);
  }

  const entityIds = new Set(document.model.entities.map((entity) => entity.id));
  const relationshipIds = new Set(
    document.model.relationships.map((relationship) => relationship.id),
  );
  const attributeIds = new Set(document.model.attributes.map((attribute) => attribute.id));

  for (const attribute of document.model.attributes) {
    const actualKind = entityIds.has(attribute.ownerId)
      ? 'entity'
      : relationshipIds.has(attribute.ownerId)
        ? 'relationship'
        : attributeIds.has(attribute.ownerId)
          ? 'attribute'
          : undefined;

    if (actualKind === undefined) {
      return messages.file.unknownAttributeOwner(describe(attribute.name));
    }
    if (attribute.ownerKind !== actualKind) {
      return messages.file.attributeOwnerKindMismatch(describe(attribute.name));
    }
    // A composite that owns itself, directly or through a chain, would make the
    // canvas and the exporter recurse forever.
    if (actualKind === 'attribute' && rootOwnerOf(document.model, attribute.id) === undefined) {
      return messages.file.attributeOwnerCycle(describe(attribute.name));
    }
  }

  for (const relationship of document.model.relationships) {
    for (const end of relationship.ends) {
      if (!entityIds.has(end.entityId)) {
        return messages.file.unknownRelationshipEntity(describe(relationship.name));
      }
    }
  }

  return null;
}

/** Elements that carry no saved position. The import layer places these. */
function findMissingPositionIds(document: ErDocument): Id[] {
  return allElementIds(document.model).filter(
    (id) => !Object.hasOwn(document.layout.positions, id),
  );
}

export interface ParsedDocument {
  document: ErDocument;
  /** Elements with no saved position, to be placed by the caller. */
  missingPositionIds: Id[];
}

export type ParseOutcome = { ok: true; value: ParsedDocument } | { ok: false; message: string };

/**
 * Validates an already-parsed, already-migrated JSON value as an `ErDocument`.
 * Older files go through `persistence/migrations.ts` first.
 */
export function parseErDocument(input: unknown): ParseOutcome {
  const version = versionOf(input);
  if (version !== null && version !== CURRENT_VERSION) {
    return { ok: false, message: messages.file.unsupportedVersion(version) };
  }

  const shape = erDocumentSchema.safeParse(input);
  if (!shape.success) {
    return { ok: false, message: messages.file.invalid };
  }

  const document: ErDocument = shape.data;
  const problem = checkIntegrity(document);
  if (problem !== null) {
    return { ok: false, message: problem };
  }

  return {
    ok: true,
    value: { document, missingPositionIds: findMissingPositionIds(document) },
  };
}
