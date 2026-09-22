import { z } from 'zod';
import { messages } from '../i18n/messages.en';
import { allElementIds } from './queries';
import type { ErDocument, Id } from './types';

/**
 * File-format validation for `.erd.json` (SPEC.md §8).
 *
 * zod checks the shape; `checkIntegrity` checks the things a shape cannot
 * express (dangling references, duplicate ids). Per the project ruling:
 *
 * - semantic damage rejects the WHOLE file, never a partial load;
 * - a missing `layout.positions` entry is NOT damage. Layout cannot affect
 *   correctness (SPEC.md §1.3), so those ids are reported back and the import
 *   layer places them. Dropping the element instead would mean the app edits
 *   the student's model, which SPEC.md §1.1 forbids.
 */

const idSchema = z.string().min(1);
// zod v4's `z.number()` already rejects NaN and Infinity.
const positionSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

const entitySchema = z.strictObject({
  id: idSchema,
  name: z.string(),
});

const attributeSchema = z.strictObject({
  id: idSchema,
  ownerId: idSchema,
  ownerKind: z.enum(['entity', 'relationship']),
  name: z.string(),
  kind: z.enum(['simple', 'key']),
});

const relationshipEndSchema = z.strictObject({
  entityId: idSchema,
  cardinality: z.enum(['1', 'N', 'M']).nullable(),
});

const relationshipSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  ends: z.tuple([relationshipEndSchema, relationshipEndSchema]),
});

const erModelSchema = z.strictObject({
  entities: z.array(entitySchema),
  attributes: z.array(attributeSchema),
  relationships: z.array(relationshipSchema),
});

const layoutSchema = z.strictObject({
  positions: z.record(z.string(), positionSchema),
});

export const erDocumentSchema = z.strictObject({
  version: z.literal(1),
  title: z.string(),
  model: erModelSchema,
  layout: layoutSchema,
  dismissedHints: z.array(z.string()),
});

/** The format version this build writes and reads without migration. */
export const CURRENT_VERSION = 1;

const versionProbeSchema = z.object({ version: z.number() });

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

  for (const attribute of document.model.attributes) {
    const ownerIsEntity = entityIds.has(attribute.ownerId);
    const ownerIsRelationship = relationshipIds.has(attribute.ownerId);

    if (!ownerIsEntity && !ownerIsRelationship) {
      return messages.file.unknownAttributeOwner(describe(attribute.name));
    }
    const actualKind = ownerIsEntity ? 'entity' : 'relationship';
    if (attribute.ownerKind !== actualKind) {
      return messages.file.attributeOwnerKindMismatch(describe(attribute.name));
    }
  }

  for (const relationship of document.model.relationships) {
    for (const end of relationship.ends) {
      if (!entityIds.has(end.entityId)) {
        return messages.file.unknownRelationshipEntity(describe(relationship.name));
      }
    }
    if (relationship.ends[0].entityId === relationship.ends[1].entityId) {
      // Self-relationships are phase 2 (SPEC.md §2) and the canvas cannot draw
      // them yet, so an MVP build refuses the file rather than loading something
      // it would render incorrectly.
      return messages.file.selfRelationshipUnsupported(describe(relationship.name));
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

/** Validates an already-parsed JSON value as an `ErDocument`. */
export function parseErDocument(input: unknown): ParseOutcome {
  const probe = versionProbeSchema.safeParse(input);
  if (probe.success && probe.data.version !== CURRENT_VERSION) {
    // Milestone 7 hooks `persistence/migrations.ts` in here.
    return { ok: false, message: messages.file.unsupportedVersion(probe.data.version) };
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

/** Validates raw `.erd.json` text. */
export function parseErDocumentJson(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: messages.file.notJson };
  }
  return parseErDocument(parsed);
}
