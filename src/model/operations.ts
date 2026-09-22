import { produce } from 'immer';
import { messages } from '../i18n/messages.en';
import { parseDismissalKey } from './dismissals';
import { ModelError } from './errors';
import { createPresentation } from './presentation';
import {
  allElementIds,
  attributesOf,
  findAttribute,
  findElementKind,
  findEntity,
  findRelationship,
  isDescendantOf,
  relationshipsTouching,
} from './queries';
import type {
  AttributeIdentifier,
  AttributeShape,
  Cardinality,
  Color,
  ComponentTheme,
  EntityKind,
  ErDocument,
  Id,
  Participation,
  Position,
  Relationship,
  RelationshipKind,
} from './types';

/**
 * Pure model operations. Every function takes a document and returns a new one;
 * none of them generate ids or read the clock, so a test can assert an exact
 * result without stubbing anything. Id generation lives in `model/ids.ts` and
 * is the caller's job.
 *
 * One call is one undoable user action (SPEC.md §5).
 *
 * Invalid input throws `ModelError`, because the UI is expected to guard first.
 * The single exception is `deleteElements`, which ignores ids that are already
 * gone so that deleting a stale selection is a harmless no-op.
 */

/** Ends below this and a relationship is no longer a relationship (SPEC.md §4). */
export const MIN_RELATIONSHIP_ENDS = 2;

export function createEmptyDocument(title: string = messages.document.untitled): ErDocument {
  return {
    version: 2,
    title,
    model: { entities: [], attributes: [], relationships: [] },
    layout: { positions: {} },
    presentation: createPresentation(),
    dismissedHints: [],
  };
}

function assertIdIsFree(document: ErDocument, id: Id): void {
  if (findElementKind(document.model, id) !== undefined) {
    throw new ModelError(`Id "${id}" is already used in this document.`);
  }
}

function endAt(relationship: Relationship, endIndex: number): void {
  if (!Number.isInteger(endIndex) || endIndex < 0 || endIndex >= relationship.ends.length) {
    throw new ModelError(`Relationship "${relationship.id}" has no end ${String(endIndex)}.`);
  }
}

export interface AddEntityParams {
  id: Id;
  name: string;
  position: Position;
  kind?: EntityKind;
}

export function addEntity(document: ErDocument, params: AddEntityParams): ErDocument {
  assertIdIsFree(document, params.id);

  return produce(document, (draft) => {
    draft.model.entities.push({
      id: params.id,
      name: params.name,
      kind: params.kind ?? 'regular',
    });
    draft.layout.positions[params.id] = { ...params.position };
  });
}

export interface AddRelationshipParams {
  id: Id;
  name: string;
  /** Participating entities, in end order. Two or more; repeats allowed. */
  entityIds: readonly Id[];
  position: Position;
  kind?: RelationshipKind;
}

export function addRelationship(document: ErDocument, params: AddRelationshipParams): ErDocument {
  assertIdIsFree(document, params.id);

  if (params.entityIds.length < MIN_RELATIONSHIP_ENDS) {
    throw new ModelError('A relationship must connect at least two ends.');
  }
  for (const entityId of params.entityIds) {
    if (!findEntity(document.model, entityId)) {
      throw new ModelError(`Unknown entity "${entityId}".`);
    }
  }

  return produce(document, (draft) => {
    draft.model.relationships.push({
      id: params.id,
      name: params.name,
      kind: params.kind ?? 'regular',
      // The same entity twice is a self-relationship, which is supported.
      ends: params.entityIds.map((entityId) => ({
        entityId,
        cardinality: null,
        participation: 'partial',
        role: null,
      })),
    });
    draft.layout.positions[params.id] = { ...params.position };
  });
}

export interface AddAttributeParams {
  id: Id;
  ownerId: Id;
  name: string;
  shape?: AttributeShape;
  identifier?: AttributeIdentifier;
  foreignKey?: boolean;
  /** Offset relative to the owner, not an absolute canvas position. */
  offset: Position;
}

export function addAttribute(document: ErDocument, params: AddAttributeParams): ErDocument {
  assertIdIsFree(document, params.id);

  const ownerKind = findElementKind(document.model, params.ownerId);
  if (ownerKind === undefined) {
    throw new ModelError(`Unknown attribute owner "${params.ownerId}".`);
  }

  if (ownerKind === 'attribute') {
    const owner = findAttribute(document.model, params.ownerId);
    if (owner?.shape !== 'composite') {
      // Making the owner composite on the student's behalf would be the app
      // reclassifying their model (SPEC.md §1, product rule 1).
      throw new ModelError(`Attribute "${params.ownerId}" is not composite, so it has no parts.`);
    }
  }

  const identifier: AttributeIdentifier = params.identifier ?? 'none';
  if (identifier !== 'none' && ownerKind !== 'entity') {
    throw new ModelError('Only an entity attribute can be a key.');
  }

  return produce(document, (draft) => {
    draft.model.attributes.push({
      id: params.id,
      ownerId: params.ownerId,
      ownerKind,
      name: params.name,
      shape: params.shape ?? 'simple',
      identifier,
      foreignKey: params.foreignKey ?? false,
    });
    draft.layout.positions[params.id] = { ...params.offset };
  });
}

export interface RenameElementParams {
  id: Id;
  /** May be empty; the checks flag that rather than the operation. */
  name: string;
}

export function renameElement(document: ErDocument, params: RenameElementParams): ErDocument {
  const kind = findElementKind(document.model, params.id);
  if (kind === undefined) {
    throw new ModelError(`Unknown element "${params.id}".`);
  }

  return produce(document, (draft) => {
    const target =
      kind === 'entity'
        ? findEntity(draft.model, params.id)
        : kind === 'relationship'
          ? findRelationship(draft.model, params.id)
          : findAttribute(draft.model, params.id);
    if (target) {
      target.name = params.name;
    }
  });
}

export function setEntityKind(document: ErDocument, id: Id, kind: EntityKind): ErDocument {
  if (!findEntity(document.model, id)) {
    throw new ModelError(`Unknown entity "${id}".`);
  }

  return produce(document, (draft) => {
    const entity = findEntity(draft.model, id);
    if (entity) {
      entity.kind = kind;
    }
  });
}

export function setRelationshipKind(
  document: ErDocument,
  id: Id,
  kind: RelationshipKind,
): ErDocument {
  if (!findRelationship(document.model, id)) {
    throw new ModelError(`Unknown relationship "${id}".`);
  }

  return produce(document, (draft) => {
    const relationship = findRelationship(draft.model, id);
    if (relationship) {
      relationship.kind = kind;
    }
  });
}

export function setAttributeShape(document: ErDocument, id: Id, shape: AttributeShape): ErDocument {
  const attribute = findAttribute(document.model, id);
  if (!attribute) {
    throw new ModelError(`Unknown attribute "${id}".`);
  }
  if (shape !== 'composite' && attributesOf(document.model, id).length > 0) {
    // Silently discarding the parts would delete the student's work.
    throw new ModelError(`Attribute "${id}" still has parts, so it must stay composite.`);
  }

  return produce(document, (draft) => {
    const target = findAttribute(draft.model, id);
    if (target) {
      target.shape = shape;
    }
  });
}

export function setAttributeIdentifier(
  document: ErDocument,
  id: Id,
  identifier: AttributeIdentifier,
): ErDocument {
  const attribute = findAttribute(document.model, id);
  if (!attribute) {
    throw new ModelError(`Unknown attribute "${id}".`);
  }
  if (identifier !== 'none' && attribute.ownerKind !== 'entity') {
    throw new ModelError('Only an entity attribute can be a key.');
  }

  return produce(document, (draft) => {
    const target = findAttribute(draft.model, id);
    if (target) {
      target.identifier = identifier;
    }
  });
}

export function setAttributeForeignKey(
  document: ErDocument,
  id: Id,
  foreignKey: boolean,
): ErDocument {
  if (!findAttribute(document.model, id)) {
    throw new ModelError(`Unknown attribute "${id}".`);
  }

  return produce(document, (draft) => {
    const target = findAttribute(draft.model, id);
    if (target) {
      target.foreignKey = foreignKey;
    }
  });
}

export interface SetCardinalityParams {
  relationshipId: Id;
  endIndex: number;
  /** `null` clears the choice, which the Inspector allows. */
  cardinality: Cardinality | null;
}

export function setCardinality(document: ErDocument, params: SetCardinalityParams): ErDocument {
  const relationship = findRelationship(document.model, params.relationshipId);
  if (!relationship) {
    throw new ModelError(`Unknown relationship "${params.relationshipId}".`);
  }
  endAt(relationship, params.endIndex);

  return produce(document, (draft) => {
    const target = findRelationship(draft.model, params.relationshipId);
    const end = target?.ends[params.endIndex];
    if (end) {
      end.cardinality = params.cardinality;
    }
  });
}

export interface SetParticipationParams {
  relationshipId: Id;
  endIndex: number;
  participation: Participation;
}

export function setParticipation(document: ErDocument, params: SetParticipationParams): ErDocument {
  const relationship = findRelationship(document.model, params.relationshipId);
  if (!relationship) {
    throw new ModelError(`Unknown relationship "${params.relationshipId}".`);
  }
  endAt(relationship, params.endIndex);

  return produce(document, (draft) => {
    const end = findRelationship(draft.model, params.relationshipId)?.ends[params.endIndex];
    if (end) {
      end.participation = params.participation;
    }
  });
}

export interface SetEndRoleParams {
  relationshipId: Id;
  endIndex: number;
  /** `null` removes the role name. */
  role: string | null;
}

export function setEndRole(document: ErDocument, params: SetEndRoleParams): ErDocument {
  const relationship = findRelationship(document.model, params.relationshipId);
  if (!relationship) {
    throw new ModelError(`Unknown relationship "${params.relationshipId}".`);
  }
  endAt(relationship, params.endIndex);

  return produce(document, (draft) => {
    const end = findRelationship(draft.model, params.relationshipId)?.ends[params.endIndex];
    if (end) {
      end.role = params.role;
    }
  });
}

export function addRelationshipEnd(
  document: ErDocument,
  relationshipId: Id,
  entityId: Id,
): ErDocument {
  if (!findRelationship(document.model, relationshipId)) {
    throw new ModelError(`Unknown relationship "${relationshipId}".`);
  }
  if (!findEntity(document.model, entityId)) {
    throw new ModelError(`Unknown entity "${entityId}".`);
  }

  return produce(document, (draft) => {
    findRelationship(draft.model, relationshipId)?.ends.push({
      entityId,
      cardinality: null,
      participation: 'partial',
      role: null,
    });
  });
}

export function removeRelationshipEnd(
  document: ErDocument,
  relationshipId: Id,
  endIndex: number,
): ErDocument {
  const relationship = findRelationship(document.model, relationshipId);
  if (!relationship) {
    throw new ModelError(`Unknown relationship "${relationshipId}".`);
  }
  endAt(relationship, endIndex);
  if (relationship.ends.length <= MIN_RELATIONSHIP_ENDS) {
    throw new ModelError('A relationship must keep at least two ends.');
  }

  return produce(document, (draft) => {
    findRelationship(draft.model, relationshipId)?.ends.splice(endIndex, 1);
  });
}

/** Sets a component's own colour, or `null` to fall back to the theme. */
export function setElementColor(document: ErDocument, id: Id, color: Color | null): ErDocument {
  if (findElementKind(document.model, id) === undefined) {
    throw new ModelError(`Unknown element "${id}".`);
  }

  return produce(document, (draft) => {
    if (color === null) {
      draft.presentation.colors = Object.fromEntries(
        Object.entries(draft.presentation.colors).filter(([key]) => key !== id),
      );
    } else {
      draft.presentation.colors[id] = color;
    }
  });
}

/** Replaces the document-wide theme. Per-component overrides are untouched. */
export function setTheme(document: ErDocument, theme: ComponentTheme): ErDocument {
  return produce(document, (draft) => {
    draft.presentation.theme = { ...theme };
  });
}

export interface ElementMove {
  id: Id;
  position: Position;
}

/**
 * Moves elements. A whole drag gesture is one call, so it becomes one undo
 * entry (SPEC.md §5). Layout never affects the checks (SPEC.md §1).
 */
export function moveElements(document: ErDocument, moves: readonly ElementMove[]): ErDocument {
  for (const move of moves) {
    if (findElementKind(document.model, move.id) === undefined) {
      throw new ModelError(`Unknown element "${move.id}".`);
    }
  }

  return produce(document, (draft) => {
    for (const move of moves) {
      const current = draft.layout.positions[move.id];
      // Skipping unchanged positions keeps immer from producing a new document,
      // so a drag that lands back where it started records no undo entry.
      if (current?.x === move.position.x && current.y === move.position.y) {
        continue;
      }
      draft.layout.positions[move.id] = { x: move.position.x, y: move.position.y };
    }
  });
}

export function setTitle(document: ErDocument, title: string): ErDocument {
  return produce(document, (draft) => {
    draft.title = title;
  });
}

/**
 * Collects everything that must disappear along with `ids` (SPEC.md §4):
 * deleting an entity also removes its attributes, every relationship touching
 * it, and those relationships' attributes. Attributes take their parts with
 * them, recursively.
 */
function collectCascade(document: ErDocument, ids: readonly Id[]): Set<Id> {
  const removed = new Set<Id>();

  const removeAttributeTree = (attributeId: Id): void => {
    if (removed.has(attributeId)) {
      return;
    }
    removed.add(attributeId);
    for (const part of attributesOf(document.model, attributeId)) {
      removeAttributeTree(part.id);
    }
  };

  const removeWithAttributes = (ownerId: Id): void => {
    removed.add(ownerId);
    for (const attribute of attributesOf(document.model, ownerId)) {
      removeAttributeTree(attribute.id);
    }
  };

  for (const id of ids) {
    switch (findElementKind(document.model, id)) {
      case 'entity':
        removeWithAttributes(id);
        for (const relationship of relationshipsTouching(document.model, id)) {
          removeWithAttributes(relationship.id);
        }
        break;
      case 'relationship':
        removeWithAttributes(id);
        break;
      case 'attribute':
        removeAttributeTree(id);
        break;
      default:
        // Already gone. Deleting a stale selection is a no-op, not an error.
        break;
    }
  }

  return removed;
}

/**
 * Drops dismissals that point at elements which no longer exist, so the list
 * cannot grow without bound. Keys that do not parse are left untouched rather
 * than silently discarded.
 */
function pruneDismissals(dismissedHints: readonly string[], removed: ReadonlySet<Id>): string[] {
  return dismissedHints.filter((key) => {
    const parsed = parseDismissalKey(key);
    if (!parsed) {
      return true;
    }
    return !parsed.targetIds.some((targetId) => removed.has(targetId));
  });
}

/** Deletes elements and everything that depends on them, as one undoable action. */
export function deleteElements(document: ErDocument, ids: readonly Id[]): ErDocument {
  const removed = collectCascade(document, ids);
  if (removed.size === 0) {
    return document;
  }

  return produce(document, (draft) => {
    draft.model.entities = draft.model.entities.filter((entity) => !removed.has(entity.id));
    draft.model.relationships = draft.model.relationships.filter(
      (relationship) => !removed.has(relationship.id),
    );
    draft.model.attributes = draft.model.attributes.filter(
      (attribute) => !removed.has(attribute.id),
    );

    draft.layout.positions = Object.fromEntries(
      Object.entries(draft.layout.positions).filter(([id]) => !removed.has(id)),
    );
    draft.presentation.colors = Object.fromEntries(
      Object.entries(draft.presentation.colors).filter(([id]) => !removed.has(id)),
    );

    draft.dismissedHints = pruneDismissals(draft.dismissedHints, removed);
  });
}

/** Ids present in `layout.positions` that no longer belong to any element. */
export function orphanedPositionIds(document: ErDocument): Id[] {
  const known = new Set(allElementIds(document.model));
  return Object.keys(document.layout.positions).filter((id) => !known.has(id));
}

/** True when moving `attributeId` under `ownerId` would create a cycle. */
export function wouldCycle(document: ErDocument, attributeId: Id, ownerId: Id): boolean {
  return attributeId === ownerId || isDescendantOf(document.model, ownerId, attributeId);
}
