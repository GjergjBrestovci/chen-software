import type { Attribute, ElementKind, Entity, ErModel, Id, Relationship } from './types';

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

/** Display name of any element, or `undefined` if the id is unknown. */
export function findElementName(model: ErModel, id: Id): string | undefined {
  return (findEntity(model, id) ?? findRelationship(model, id) ?? findAttribute(model, id))?.name;
}

/** Attributes hanging off one entity or relationship, in model order. */
export function attributesOf(model: ErModel, ownerId: Id): Attribute[] {
  return model.attributes.filter((attribute) => attribute.ownerId === ownerId);
}

/** Every relationship with at least one end on the given entity. */
export function relationshipsTouching(model: ErModel, entityId: Id): Relationship[] {
  return model.relationships.filter((relationship) =>
    relationship.ends.some((end) => end.entityId === entityId),
  );
}

/** Ids of every element in the model. Used for integrity checks and pruning. */
export function allElementIds(model: ErModel): Id[] {
  return [
    ...model.entities.map((entity) => entity.id),
    ...model.relationships.map((relationship) => relationship.id),
    ...model.attributes.map((attribute) => attribute.id),
  ];
}
