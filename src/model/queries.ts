import type {
  Attribute,
  ElementKind,
  Entity,
  ErModel,
  Id,
  Relationship,
  Specialization,
} from './types';

export function findEntity(model: ErModel, id: Id): Entity | undefined {
  return model.entities.find((entity) => entity.id === id);
}

export function findRelationship(model: ErModel, id: Id): Relationship | undefined {
  return model.relationships.find((relationship) => relationship.id === id);
}

export function findAttribute(model: ErModel, id: Id): Attribute | undefined {
  return model.attributes.find((attribute) => attribute.id === id);
}

/** Returns what kind of element an id refers to, or `undefined` if unknown. */
export function findElementKind(model: ErModel, id: Id): ElementKind | undefined {
  if (findEntity(model, id)) return 'entity';
  if (findRelationship(model, id)) return 'relationship';
  if (findAttribute(model, id)) return 'attribute';
  return undefined;
}

export interface ElementRef {
  kind: ElementKind;
  name: string;
}

/**
 * Kind and name of any element in one lookup, or `undefined` if the id is
 * unknown. Callers that need both avoid a second, provably-redundant check.
 */
export function findElementRef(model: ErModel, id: Id): ElementRef | undefined {
  const entity = findEntity(model, id);
  if (entity) return { kind: 'entity', name: entity.name };

  const relationship = findRelationship(model, id);
  if (relationship) return { kind: 'relationship', name: relationship.name };

  const attribute = findAttribute(model, id);
  if (attribute) return { kind: 'attribute', name: attribute.name };

  return undefined;
}

/** Display name of any element, or `undefined` if the id is unknown. */
export function findElementName(model: ErModel, id: Id): string | undefined {
  return (findEntity(model, id) ?? findRelationship(model, id) ?? findAttribute(model, id))?.name;
}

/** Attributes hanging off one entity or relationship, in model order. */
export function attributesOf(model: ErModel, ownerId: Id): Attribute[] {
  return model.attributes.filter((attribute) => attribute.ownerId === ownerId);
}

/**
 * Walks from an attribute up through its composite parents to the entity or
 * relationship that ultimately owns it. Returns `undefined` if the chain is
 * broken or cyclic, so callers never loop forever on a damaged model.
 */
export function rootOwnerOf(model: ErModel, attributeId: Id): Entity | Relationship | undefined {
  const seen = new Set<Id>([attributeId]);
  let current = findAttribute(model, attributeId);

  while (current) {
    if (current.ownerKind !== 'attribute') {
      return current.ownerKind === 'entity'
        ? findEntity(model, current.ownerId)
        : findRelationship(model, current.ownerId);
    }
    if (seen.has(current.ownerId)) {
      return undefined;
    }
    seen.add(current.ownerId);
    current = findAttribute(model, current.ownerId);
  }

  return undefined;
}

/** True when `ancestorId` owns `attributeId`, directly or through composites. */
export function isDescendantOf(model: ErModel, attributeId: Id, ancestorId: Id): boolean {
  const seen = new Set<Id>();
  let current = findAttribute(model, attributeId);

  while (current && !seen.has(current.id)) {
    if (current.ownerId === ancestorId) {
      return true;
    }
    seen.add(current.id);
    current = findAttribute(model, current.ownerId);
  }

  return false;
}

/** Every relationship with at least one end on the given entity. */
export function relationshipsTouching(model: ErModel, entityId: Id): Relationship[] {
  return model.relationships.filter((relationship) =>
    relationship.ends.some((end) => end.entityId === entityId),
  );
}

/** Every specialization the entity appears in, as superclass or as subclass. */
export function specializationsInvolving(model: ErModel, entityId: Id): Specialization[] {
  return model.specializations.filter(
    (spec) => spec.superId === entityId || spec.subIds.includes(entityId),
  );
}

/** The specialization node with this id, if there is one. */
export function findSpecialization(model: ErModel, id: Id): Specialization | undefined {
  return model.specializations.find((spec) => spec.id === id);
}

/** The node that splits `superId` into subclasses, if it is split at all. */
export function specializationOfSuper(model: ErModel, superId: Id): Specialization | undefined {
  return model.specializations.find((spec) => spec.superId === superId);
}

/** The node `subId` is a subclass in, if it is a subclass at all. */
export function specializationOfSub(model: ErModel, subId: Id): Specialization | undefined {
  return model.specializations.find((spec) => spec.subIds.includes(subId));
}

/**
 * True when `ancestorId` sits above `descendantId` in an ISA chain. A cyclic
 * model cannot come from a valid file; as in `rootOwnerOf`, the walk then
 * answers `false` rather than looping forever.
 */
export function isAncestorOf(model: ErModel, ancestorId: Id, descendantId: Id): boolean {
  const seen = new Set<Id>([descendantId]);
  let current = descendantId;

  for (;;) {
    const parent = specializationOfSub(model, current)?.superId;
    if (parent === undefined || seen.has(parent)) {
      return false;
    }
    if (parent === ancestorId) {
      return true;
    }
    seen.add(parent);
    current = parent;
  }
}

/** Ids of every element in the model. Used for integrity checks and pruning. */
export function allElementIds(model: ErModel): Id[] {
  return [
    ...model.entities.map((entity) => entity.id),
    ...model.relationships.map((relationship) => relationship.id),
    ...model.specializations.map((spec) => spec.id),
    ...model.attributes.map((attribute) => attribute.id),
  ];
}
