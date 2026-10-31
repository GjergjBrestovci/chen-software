import { describe, expect, it } from 'vitest';
import { addAttribute, addEntity, addRelationship, createEmptyDocument } from '../operations';
import {
  allElementIds,
  canAttachSub,
  canSpecialize,
  findSpecialization,
  isaConstraintText,
  isAncestorOf,
  isDescendantOf,
  specializationOfSub,
  specializationOfSuper,
  specializationsInvolving,
  rootOwnerOf,
  attributesOf,
  findAttribute,
  findElementKind,
  findElementName,
  findElementRef,
  findEntity,
  findRelationship,
  relationshipsTouching,
} from '../queries';
import type { Entity, ErDocument, ErModel } from '../types';

const origin = { x: 0, y: 0 };

function sample(): ErDocument {
  let document = createEmptyDocument('Sample');
  document = addEntity(document, { id: 'a', name: 'AUTHOR', position: origin });
  document = addEntity(document, { id: 'b', name: 'BOOK', position: origin });
  document = addEntity(document, { id: 'c', name: 'GENRE', position: origin });
  document = addRelationship(document, {
    id: 'r',
    name: 'writes',
    entityIds: ['a', 'b'],
    position: origin,
  });
  document = addAttribute(document, { id: 'at1', ownerId: 'a', name: 'name', offset: origin });
  document = addAttribute(document, { id: 'at2', ownerId: 'a', name: 'born', offset: origin });
  document = addAttribute(document, { id: 'at3', ownerId: 'r', name: 'share', offset: origin });
  return document;
}

describe('queries', () => {
  const { model } = sample();

  it('finds each kind of element', () => {
    expect(findEntity(model, 'a')?.name).toBe('AUTHOR');
    expect(findRelationship(model, 'r')?.name).toBe('writes');
    expect(findAttribute(model, 'at1')?.name).toBe('name');
  });

  it('returns undefined for unknown ids', () => {
    expect(findEntity(model, 'nope')).toBeUndefined();
    expect(findRelationship(model, 'nope')).toBeUndefined();
    expect(findAttribute(model, 'nope')).toBeUndefined();
  });

  it('classifies ids', () => {
    expect(findElementKind(model, 'a')).toBe('entity');
    expect(findElementKind(model, 'r')).toBe('relationship');
    expect(findElementKind(model, 'at1')).toBe('attribute');
    expect(findElementKind(model, 'nope')).toBeUndefined();
  });

  it('lists the attributes of an owner in model order', () => {
    expect(attributesOf(model, 'a').map((attribute) => attribute.name)).toEqual(['name', 'born']);
    expect(attributesOf(model, 'r').map((attribute) => attribute.name)).toEqual(['share']);
    expect(attributesOf(model, 'c')).toEqual([]);
  });

  it('finds relationships touching an entity from either end', () => {
    expect(relationshipsTouching(model, 'a').map((r) => r.id)).toEqual(['r']);
    expect(relationshipsTouching(model, 'b').map((r) => r.id)).toEqual(['r']);
    expect(relationshipsTouching(model, 'c')).toEqual([]);
  });

  it('collects every element id', () => {
    expect(allElementIds(model).sort()).toEqual(['a', 'at1', 'at2', 'at3', 'b', 'c', 'r']);
  });
});

describe('findElementName', () => {
  const { model } = sample();

  it('names an entity, a relationship and an attribute alike', () => {
    expect(findElementName(model, 'a')).toBe('AUTHOR');
    expect(findElementName(model, 'r')).toBe('writes');
    expect(findElementName(model, 'at3')).toBe('share');
  });

  it('has no name for an unknown id', () => {
    expect(findElementName(model, 'ghost')).toBeUndefined();
  });
});

describe('composite ancestry', () => {
  /** BOOK ← name(composite) ← first, so `first` is two levels down. */
  function nested(): ErDocument {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'book', name: 'BOOK', position: origin });
    document = addAttribute(document, {
      id: 'name',
      ownerId: 'book',
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
    return document;
  }

  it('walks a part up to the entity that owns it', () => {
    expect(rootOwnerOf(nested().model, 'first')?.id).toBe('book');
    expect(rootOwnerOf(nested().model, 'name')?.id).toBe('book');
  });

  it('walks up to a relationship owner too', () => {
    const { model } = sample();
    expect(rootOwnerOf(model, 'at3')?.id).toBe('r');
  });

  it('has no root owner for an unknown attribute', () => {
    expect(rootOwnerOf(nested().model, 'ghost')).toBeUndefined();
  });

  it('gives up rather than looping on a cyclic model', () => {
    const document = nested();
    const cyclic: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name'
          ? { ...attribute, ownerId: 'first', ownerKind: 'attribute' as const }
          : attribute,
      ),
    };
    expect(rootOwnerOf(cyclic, 'first')).toBeUndefined();
  });

  it('has no root owner when the chain is broken', () => {
    const document = nested();
    const broken: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name' ? { ...attribute, ownerId: 'ghost' } : attribute,
      ),
    };
    expect(rootOwnerOf(broken, 'first')).toBeUndefined();
  });

  it('recognises descendants at any depth', () => {
    const { model } = nested();
    expect(isDescendantOf(model, 'first', 'name')).toBe(true);
    expect(isDescendantOf(model, 'first', 'book')).toBe(true);
    expect(isDescendantOf(model, 'name', 'first')).toBe(false);
    expect(isDescendantOf(model, 'ghost', 'book')).toBe(false);
  });

  it('terminates on a cycle instead of hanging', () => {
    const document = nested();
    const cyclic: ErModel = {
      ...document.model,
      attributes: document.model.attributes.map((attribute) =>
        attribute.id === 'name'
          ? { ...attribute, ownerId: 'first', ownerKind: 'attribute' as const }
          : attribute,
      ),
    };
    expect(isDescendantOf(cyclic, 'first', 'book')).toBe(false);
  });
});

describe('specialization queries', () => {
  /** The lesson-05 zoo: ANIMAL → {MAMMAL, BIRD}, MAMMAL → {CARNIVORE, HERBIVORE}. */
  function chain(): ErModel {
    let document = createEmptyDocument('Zoo');
    for (const name of ['ANIMAL', 'MAMMAL', 'BIRD', 'CARNIVORE', 'HERBIVORE']) {
      document = addEntity(document, { id: name.toLowerCase(), name, position: origin });
    }
    return {
      ...document.model,
      specializations: [
        {
          id: 'isa1',
          superId: 'animal',
          subIds: ['mammal', 'bird'],
          coverage: 'total',
          overlap: 'disjoint',
        },
        {
          id: 'isa2',
          superId: 'mammal',
          subIds: ['carnivore', 'herbivore'],
          coverage: 'partial',
          overlap: 'disjoint',
        },
      ],
    };
  }

  it('finds a specialization by id', () => {
    expect(findSpecialization(chain(), 'isa1')?.superId).toBe('animal');
    expect(findSpecialization(chain(), 'isa2')?.subIds).toEqual(['carnivore', 'herbivore']);
    expect(findSpecialization(chain(), 'ghost')).toBeUndefined();
  });

  it('finds the node from the superclass side', () => {
    expect(specializationOfSuper(chain(), 'animal')?.id).toBe('isa1');
    expect(specializationOfSuper(chain(), 'mammal')?.id).toBe('isa2');
    expect(specializationOfSuper(chain(), 'bird')).toBeUndefined();
  });

  it('finds the node from the subclass side', () => {
    expect(specializationOfSub(chain(), 'mammal')?.id).toBe('isa1');
    expect(specializationOfSub(chain(), 'carnivore')?.id).toBe('isa2');
    expect(specializationOfSub(chain(), 'animal')).toBeUndefined();
  });

  it('lists every specialization an entity belongs to, either side', () => {
    expect(specializationsInvolving(chain(), 'mammal').map((s) => s.id)).toEqual(['isa1', 'isa2']);
    expect(specializationsInvolving(chain(), 'bird').map((s) => s.id)).toEqual(['isa1']);
    expect(specializationsInvolving(chain(), 'animal').map((s) => s.id)).toEqual(['isa1']);
  });

  it('walks ISA ancestors at any depth', () => {
    const model = chain();
    expect(isAncestorOf(model, 'animal', 'carnivore')).toBe(true);
    expect(isAncestorOf(model, 'mammal', 'carnivore')).toBe(true);
    expect(isAncestorOf(model, 'mammal', 'bird')).toBe(false);
    expect(isAncestorOf(model, 'carnivore', 'animal')).toBe(false);
    expect(isAncestorOf(model, 'animal', 'animal')).toBe(false);
  });

  it('terminates on a cyclic specialization instead of hanging', () => {
    const model = chain();
    const cyclic: ErModel = {
      ...model,
      specializations: model.specializations.map((spec) =>
        spec.id === 'isa2' ? { ...spec, subIds: ['animal', 'carnivore'] } : spec,
      ),
    };
    expect(isAncestorOf(cyclic, 'herbivore', 'animal')).toBe(false);
  });

  it('includes specialization ids in allElementIds', () => {
    expect(allElementIds(chain()).sort()).toEqual([
      'animal',
      'bird',
      'carnivore',
      'herbivore',
      'isa1',
      'isa2',
      'mammal',
    ]);
  });

  it('classifies specialization ids like any other element', () => {
    const model = chain();
    expect(findElementKind(model, 'isa1')).toBe('specialization');
    expect(findElementRef(model, 'isa1')).toEqual({ kind: 'specialization', name: 'ISA' });
    expect(findElementName(model, 'isa1')).toBe('ISA');
  });

  it('writes the course constraint text from the two flags', () => {
    expect(isaConstraintText('total', 'disjoint')).toBe('(t,d)');
    expect(isaConstraintText('total', 'non-disjoint')).toBe('(t,nd)');
    expect(isaConstraintText('partial', 'disjoint')).toBe('(p,d)');
    expect(isaConstraintText('partial', 'non-disjoint')).toBe('(p,nd)');
  });
});

describe('specialization eligibility', () => {
  function zoo(): ErModel {
    const entity = (id: string, kind: 'regular' | 'weak' = 'regular'): Entity => ({
      id,
      name: id.toUpperCase(),
      kind,
    });
    return {
      entities: [
        entity('person'),
        entity('student'),
        entity('teacher'),
        entity('advisor'),
        entity('ghost', 'weak'),
        entity('book'),
        entity('library'),
        entity('shelf'),
      ],
      attributes: [],
      relationships: [],
      specializations: [
        {
          id: 'isa1',
          superId: 'person',
          subIds: ['student', 'teacher'],
          coverage: 'total',
          overlap: 'disjoint',
        },
        {
          id: 'isa2',
          superId: 'student',
          subIds: ['advisor', 'book'],
          coverage: 'partial',
          overlap: 'disjoint',
        },
      ],
    };
  }

  it('allows a plain superclass into plain subclasses, and answers the rule set', () => {
    const model = zoo();
    expect(canSpecialize(model, 'person', ['student', 'teacher'])).toBe(false); // person is split
    expect(canSpecialize(model, 'teacher', ['person', 'book'])).toBe(false); // teacher is a subclass
    expect(canSpecialize(model, 'ghost', ['book', 'teacher'])).toBe(false); // weak
    expect(canSpecialize(model, 'person', ['book', 'teacher'])).toBe(false); // split already taken
    expect(canSpecialize(model, 'book', ['student', 'ghost'])).toBe(false); // student elsewhere
    expect(canSpecialize(model, 'teacher', ['library', 'shelf'])).toBe(true);
    expect(canSpecialize(model, 'advisor', ['library', 'shelf'])).toBe(true);
  });

  it('refuses the superclass among its own subclasses, repeats, and missing entities', () => {
    const model = zoo();
    expect(canSpecialize(model, 'teacher', ['teacher', 'book'])).toBe(false);
    expect(canSpecialize(model, 'teacher', ['book', 'book'])).toBe(false);
    expect(canSpecialize(model, 'teacher', ['book', 'nobody'])).toBe(false);
    expect(canSpecialize(model, 'nobody', ['book', 'teacher'])).toBe(false);
  });

  it('refuses a chain that would close a cycle', () => {
    // STUDENT sits below PERSON; a split of BOOK (below STUDENT) back into
    // STUDENT would loop STUDENT→ADVISOR/BOOK→…→STUDENT.
    // BOOK sits below STUDENT, which sits below PERSON: PERSON is not a
    // subclass anywhere, so only the cycle itself may refuse this.
    expect(canSpecialize(zoo(), 'book', ['person', 'library'])).toBe(false);
  });

  it('judges attaches against the live node', () => {
    const model = zoo();
    expect(canAttachSub(model, 'isa1', 'advisor')).toBe(false); // advisor is a subclass of isa2
    expect(canAttachSub(model, 'isa1', 'library')).toBe(true);
    expect(canAttachSub(model, 'isa1', 'person')).toBe(false); // its own superclass
    expect(canAttachSub(model, 'isa1', 'student')).toBe(false); // already a subclass
    expect(canAttachSub(model, 'isa1', 'ghost')).toBe(false); // weak
    expect(canAttachSub(model, 'isa1', 'nobody')).toBe(false); // unknown
    expect(canAttachSub(model, 'ghost', 'advisor')).toBe(false); // unknown node
  });

  it('refuses an attach that would close a cycle', () => {
    // PERSON sits above STUDENT, which is the superclass of isa2.
    expect(canAttachSub(zoo(), 'isa2', 'person')).toBe(false);
  });
});
