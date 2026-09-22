import { describe, expect, it } from 'vitest';
import { ModelError } from '../errors';
import {
  addAttribute,
  addEntity,
  addRelationship,
  addRelationshipEnd,
  createEmptyDocument,
  deleteElements,
  removeRelationshipEnd,
  setAttributeForeignKey,
  setAttributeIdentifier,
  setAttributeShape,
  setElementColor,
  setEndRole,
  setEntityKind,
  setParticipation,
  setRelationshipKind,
  setTheme,
  wouldCycle,
} from '../operations';
import { colorFor, DEFAULT_THEME, hasColorOverride } from '../presentation';
import { attributesOf, findAttribute, findEntity, findRelationship, rootOwnerOf } from '../queries';
import type { ErDocument } from '../types';

const origin = { x: 0, y: 0 };

/** DEPARTMENT ─ offers ─ COURSE, plus a composite attribute on DEPARTMENT. */
function sample(): ErDocument {
  let document = createEmptyDocument();
  document = addEntity(document, { id: 'dept', name: 'DEPARTMENT', position: origin });
  document = addEntity(document, { id: 'course', name: 'COURSE', position: origin, kind: 'weak' });
  document = addRelationship(document, {
    id: 'offers',
    name: 'offers',
    entityIds: ['dept', 'course'],
    position: origin,
    kind: 'identifying',
  });
  document = addAttribute(document, {
    id: 'name',
    ownerId: 'dept',
    name: 'name',
    shape: 'composite',
    offset: origin,
  });
  document = addAttribute(document, {
    id: 'first',
    ownerId: 'name',
    name: 'first',
    offset: origin,
  });
  document = addAttribute(document, { id: 'last', ownerId: 'name', name: 'last', offset: origin });
  return document;
}

describe('entity and relationship kinds', () => {
  it('creates a weak entity and an identifying relationship', () => {
    const { model } = sample();
    expect(findEntity(model, 'course')?.kind).toBe('weak');
    expect(findRelationship(model, 'offers')?.kind).toBe('identifying');
  });

  it('defaults to regular', () => {
    const { model } = sample();
    expect(findEntity(model, 'dept')?.kind).toBe('regular');
  });

  it('toggles an entity between regular and weak', () => {
    let document = setEntityKind(sample(), 'dept', 'weak');
    expect(findEntity(document.model, 'dept')?.kind).toBe('weak');
    document = setEntityKind(document, 'dept', 'regular');
    expect(findEntity(document.model, 'dept')?.kind).toBe('regular');
  });

  it('toggles a relationship between regular and identifying', () => {
    const document = setRelationshipKind(sample(), 'offers', 'regular');
    expect(findRelationship(document.model, 'offers')?.kind).toBe('regular');
  });

  it('rejects unknown ids', () => {
    expect(() => setEntityKind(sample(), 'ghost', 'weak')).toThrow(ModelError);
    expect(() => setRelationshipKind(sample(), 'ghost', 'identifying')).toThrow(ModelError);
  });
});

describe('composite attributes', () => {
  it('nests parts under their attribute', () => {
    const { model } = sample();
    expect(attributesOf(model, 'name').map((part) => part.name)).toEqual(['first', 'last']);
    expect(findAttribute(model, 'first')?.ownerKind).toBe('attribute');
  });

  it('resolves the entity that ultimately owns a part', () => {
    expect(rootOwnerOf(sample().model, 'first')?.id).toBe('dept');
  });

  it('refuses to drop the composite shape while parts remain', () => {
    expect(() => setAttributeShape(sample(), 'name', 'simple')).toThrow(ModelError);
  });

  it('allows the shape change once the parts are gone', () => {
    let document = deleteElements(sample(), ['first', 'last']);
    document = setAttributeShape(document, 'name', 'derived');
    expect(findAttribute(document.model, 'name')?.shape).toBe('derived');
  });

  it('deletes parts along with their composite', () => {
    const document = deleteElements(sample(), ['name']);
    expect(findAttribute(document.model, 'first')).toBeUndefined();
    expect(findAttribute(document.model, 'last')).toBeUndefined();
  });

  it('deletes a whole attribute tree when the entity goes', () => {
    const document = deleteElements(sample(), ['dept']);
    expect(document.model.attributes).toEqual([]);
  });

  it('rejects an identifier on a part, which belongs to an attribute', () => {
    expect(() => setAttributeIdentifier(sample(), 'first', 'key')).toThrow(ModelError);
  });

  it('spots an ownership cycle before one can be created', () => {
    const document = sample();
    expect(wouldCycle(document, 'name', 'first')).toBe(true);
    expect(wouldCycle(document, 'name', 'name')).toBe(true);
    expect(wouldCycle(document, 'first', 'name')).toBe(false);
  });
});

describe('attribute shape, identifier and foreign key', () => {
  it('keeps the two axes independent, so a composite can be a key', () => {
    let document = setAttributeIdentifier(sample(), 'name', 'key');
    document = setAttributeForeignKey(document, 'name', true);
    const attribute = findAttribute(document.model, 'name');
    expect(attribute?.shape).toBe('composite');
    expect(attribute?.identifier).toBe('key');
    expect(attribute?.foreignKey).toBe(true);
  });

  it('marks and unmarks a foreign key', () => {
    let document = setAttributeForeignKey(sample(), 'first', true);
    expect(findAttribute(document.model, 'first')?.foreignKey).toBe(true);
    document = setAttributeForeignKey(document, 'first', false);
    expect(findAttribute(document.model, 'first')?.foreignKey).toBe(false);
  });

  it('rejects unknown attributes', () => {
    expect(() => setAttributeShape(sample(), 'ghost', 'derived')).toThrow(ModelError);
    expect(() => setAttributeForeignKey(sample(), 'ghost', true)).toThrow(ModelError);
  });
});

describe('relationship ends', () => {
  it('starts every end partial with no role', () => {
    const end = findRelationship(sample().model, 'offers')?.ends[0];
    expect(end?.participation).toBe('partial');
    expect(end?.role).toBeNull();
  });

  it('sets participation per end', () => {
    const document = setParticipation(sample(), {
      relationshipId: 'offers',
      endIndex: 1,
      participation: 'total',
    });
    const ends = findRelationship(document.model, 'offers')?.ends ?? [];
    expect(ends.map((end) => end.participation)).toEqual(['partial', 'total']);
  });

  it('names and clears a role', () => {
    let document = setEndRole(sample(), {
      relationshipId: 'offers',
      endIndex: 0,
      role: 'supervisor',
    });
    expect(findRelationship(document.model, 'offers')?.ends[0]?.role).toBe('supervisor');
    document = setEndRole(document, { relationshipId: 'offers', endIndex: 0, role: null });
    expect(findRelationship(document.model, 'offers')?.ends[0]?.role).toBeNull();
  });

  it('grows a binary relationship into a ternary one', () => {
    let document = addEntity(sample(), { id: 'sem', name: 'SEMESTER', position: origin });
    document = addRelationshipEnd(document, 'offers', 'sem');
    expect(findRelationship(document.model, 'offers')?.ends).toHaveLength(3);
  });

  it('removes an end back down to two, but no further', () => {
    let document = addEntity(sample(), { id: 'sem', name: 'SEMESTER', position: origin });
    document = addRelationshipEnd(document, 'offers', 'sem');
    document = removeRelationshipEnd(document, 'offers', 2);
    expect(findRelationship(document.model, 'offers')?.ends).toHaveLength(2);
    expect(() => removeRelationshipEnd(document, 'offers', 1)).toThrow(ModelError);
  });

  it('rejects an end index that does not exist', () => {
    for (const endIndex of [-1, 2, 1.5, Number.NaN]) {
      expect(() =>
        setParticipation(sample(), { relationshipId: 'offers', endIndex, participation: 'total' }),
      ).toThrow(ModelError);
    }
  });

  it('rejects unknown relationships and entities', () => {
    expect(() => addRelationshipEnd(sample(), 'ghost', 'dept')).toThrow(ModelError);
    expect(() => addRelationshipEnd(sample(), 'offers', 'ghost')).toThrow(ModelError);
    expect(() => removeRelationshipEnd(sample(), 'ghost', 0)).toThrow(ModelError);
    expect(() => setEndRole(sample(), { relationshipId: 'ghost', endIndex: 0, role: 'x' })).toThrow(
      ModelError,
    );
  });

  it('deletes a self-relationship with the entity it loops on', () => {
    let document = addRelationship(sample(), {
      id: 'sup',
      name: 'supervises',
      entityIds: ['dept', 'dept'],
      position: origin,
    });
    document = deleteElements(document, ['dept']);
    expect(findRelationship(document.model, 'sup')).toBeUndefined();
  });
});

describe('colour', () => {
  it('falls back to the theme colour for its kind', () => {
    const { presentation } = sample();
    expect(colorFor(presentation, 'dept', 'entity')).toBe(DEFAULT_THEME.entity);
    expect(hasColorOverride(presentation, 'dept')).toBe(false);
  });

  it('prefers a per-component override', () => {
    const document = setElementColor(sample(), 'dept', '#2563eb');
    expect(colorFor(document.presentation, 'dept', 'entity')).toBe('#2563eb');
    expect(hasColorOverride(document.presentation, 'dept')).toBe(true);
  });

  it('returns to the theme when the override is cleared', () => {
    let document = setElementColor(sample(), 'dept', '#2563eb');
    document = setElementColor(document, 'dept', null);
    expect(hasColorOverride(document.presentation, 'dept')).toBe(false);
    expect(colorFor(document.presentation, 'dept', 'entity')).toBe(DEFAULT_THEME.entity);
  });

  it('changes the theme without disturbing overrides', () => {
    let document = setElementColor(sample(), 'dept', '#2563eb');
    document = setTheme(document, {
      entity: '#b91c1c',
      relationship: '#b91c1c',
      attribute: '#b91c1c',
    });
    expect(colorFor(document.presentation, 'dept', 'entity')).toBe('#2563eb');
    expect(colorFor(document.presentation, 'course', 'entity')).toBe('#b91c1c');
  });

  it('never touches the model, so a recolour cannot change any check', () => {
    const before = sample();
    const after = setElementColor(before, 'dept', '#2563eb');
    expect(after.model).toEqual(before.model);
  });

  it('drops the override when the component is deleted', () => {
    let document = setElementColor(sample(), 'course', '#047857');
    document = deleteElements(document, ['course']);
    expect(hasColorOverride(document.presentation, 'course')).toBe(false);
  });

  it('rejects an unknown element', () => {
    expect(() => setElementColor(sample(), 'ghost', '#000000')).toThrow(ModelError);
  });
});

describe('cascade edge cases', () => {
  it('rejects setting participation on a relationship that is gone', () => {
    expect(() =>
      setParticipation(sample(), {
        relationshipId: 'ghost',
        endIndex: 0,
        participation: 'total',
      }),
    ).toThrow(ModelError);
  });

  it('copes with a composite and its own part in one selection', () => {
    const document = deleteElements(sample(), ['name', 'first']);
    expect(document.model.attributes).toEqual([]);
  });

  it('copes with a part listed before its composite', () => {
    const document = deleteElements(sample(), ['first', 'name']);
    expect(document.model.attributes).toEqual([]);
  });
});
