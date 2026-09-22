import { produce } from 'immer';
import { messages } from '../i18n/messages.en';
import { parseDismissalKey } from './dismissals';
import { ModelError } from './errors';
import {
  allElementIds,
  attributesOf,
  findAttribute,
  findElementKind,
  findEntity,
  findRelationship,
  relationshipsTouching,
} from './queries';
import type { AttributeKind, Cardinality, EndIndex, ErDocument, Id, Position } from './types';

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

export function createEmptyDocument(title: string = messages.document.untitled): ErDocument {
  return {
    version: 1,
    title,
    model: { entities: [], attributes: [], relationships: [] },
    layout: { positions: {} },
    dismissedHints: [],
  };
}

function assertIdIsFree(document: ErDocument, id: Id): void {
  if (findElementKind(document.model, id) !== undefined) {
    throw new ModelError(`Id "${id}" is already used in this document.`);
  }
}

export interface AddEntityParams {
  id: Id;
  name: string;
  position: Position;
}

export function addEntity(document: ErDocument, params: AddEntityParams): ErDocument {
  assertIdIsFree(document, params.id);

  return produce(document, (draft) => {
    draft.model.entities.push({ id: params.id, name: params.name });
    draft.layout.positions[params.id] = { ...params.position };
  });
}

export interface AddRelationshipParams {
  id: Id;
  name: string;
  /** The two entities being related, in end order. */
  entityIds: [Id, Id];
  position: Position;
}

export function addRelationship(document: ErDocument, params: AddRelationshipParams): ErDocument {
  assertIdIsFree(document, params.id);

  const [firstId, secondId] = params.entityIds;
  for (const entityId of params.entityIds) {
    if (!findEntity(document.model, entityId)) {
      throw new ModelError(`Unknown entity "${entityId}".`);
    }
  }
  if (firstId === secondId) {
    // Self-relationships need role names and double diamonds: phase 2 (SPEC.md §2).
    throw new ModelError('A relationship must connect two different entities.');
  }

  return produce(document, (draft) => {
    draft.model.relationships.push({
      id: params.id,
      name: params.name,
      ends: [
        { entityId: firstId, cardinality: null },
        { entityId: secondId, cardinality: null },
      ],
    });
    draft.layout.positions[params.id] = { ...params.position };
  });
}

export interface AddAttributeParams {
  id: Id;
  ownerId: Id;
  name: string;
  kind?: AttributeKind;
  /** Offset relative to the owner, not an absolute canvas position. */
  offset: Position;
}

export function addAttribute(document: ErDocument, params: AddAttributeParams): ErDocument {
  assertIdIsFree(document, params.id);

  const ownerKind = findElementKind(document.model, params.ownerId);
  if (ownerKind !== 'entity' && ownerKind !== 'relationship') {
    throw new ModelError(`Unknown attribute owner "${params.ownerId}".`);
  }

  const kind: AttributeKind = params.kind ?? 'simple';
  if (kind === 'key' && ownerKind === 'relationship') {
    // SPEC.md §2: relationship attributes are non-key.
    throw new ModelError('A relationship attribute cannot be a key attribute.');
  }

  return produce(document, (draft) => {
    draft.model.attributes.push({
      id: params.id,
      ownerId: params.ownerId,
      ownerKind,
      name: params.name,
      kind,
    });
    draft.layout.positions[params.id] = { ...params.offset };
  });
}

export interface RenameElementParams {
  id: Id;
  /** May be empty; the validator flags that rather than the operation. */
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

export interface SetAttributeKindParams {
  id: Id;
  kind: AttributeKind;
}

export function setAttributeKind(document: ErDocument, params: SetAttributeKindParams): ErDocument {
  const attribute = findAttribute(document.model, params.id);
  if (!attribute) {
    throw new ModelError(`Unknown attribute "${params.id}".`);
  }
  if (params.kind === 'key' && attribute.ownerKind === 'relationship') {
    throw new ModelError('A relationship attribute cannot be a key attribute.');
  }

  return produce(document, (draft) => {
    const target = findAttribute(draft.model, params.id);
    if (target) {
      target.kind = params.kind;
    }
  });
}

export interface SetCardinalityParams {
  relationshipId: Id;
  endIndex: EndIndex;
  /** `null` clears the choice, which the Inspector allows. */
  cardinality: Cardinality | null;
}

export function setCardinality(document: ErDocument, params: SetCardinalityParams): ErDocument {
  if (!findRelationship(document.model, params.relationshipId)) {
    throw new ModelError(`Unknown relationship "${params.relationshipId}".`);
  }

  return produce(document, (draft) => {
    const relationship = findRelationship(draft.model, params.relationshipId);
    if (relationship) {
      relationship.ends[params.endIndex].cardinality = params.cardinality;
    }
  });
}

export interface ElementMove {
  id: Id;
  position: Position;
}

/**
 * Moves elements. A whole drag gesture is one call, so it becomes one undo
 * entry (SPEC.md §5). Layout never affects validation (SPEC.md §1.3).
 */
export function moveElements(document: ErDocument, moves: readonly ElementMove[]): ErDocument {
  for (const move of moves) {
    if (findElementKind(document.model, move.id) === undefined) {
      throw new ModelError(`Unknown element "${move.id}".`);
    }
  }

  return produce(document, (draft) => {
    for (const move of moves) {
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
 * it, and those relationships' attributes.
 */
function collectCascade(document: ErDocument, ids: readonly Id[]): Set<Id> {
  const removed = new Set<Id>();

  const removeWithAttributes = (ownerId: Id): void => {
    removed.add(ownerId);
    for (const attribute of attributesOf(document.model, ownerId)) {
      removed.add(attribute.id);
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
        removed.add(id);
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

    draft.dismissedHints = pruneDismissals(draft.dismissedHints, removed);
  });
}

/** Ids present in `layout.positions` that no longer belong to any element. */
export function orphanedPositionIds(document: ErDocument): Id[] {
  const known = new Set(allElementIds(document.model));
  return Object.keys(document.layout.positions).filter((id) => !known.has(id));
}
