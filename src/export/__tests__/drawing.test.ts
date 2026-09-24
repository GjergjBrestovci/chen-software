import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CARDINALITY_PLACEHOLDER, describeDiagram } from '../drawing';
import type { Drawing, DrawnShape } from '../drawing';
import { boundsOf, distance, unionBounds } from '../../geometry';
import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
  setAttributeForeignKey,
  setElementColor,
} from '../../model/operations';
import { readDocumentJson } from '../../persistence/migrations';
import type { ErDocument } from '../../model/types';

function university(): ErDocument {
  const text = readFileSync(`${process.cwd()}/fixtures/university.erd.json`, 'utf8');
  const outcome = readDocumentJson(text);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.document;
}

function shapeFor(drawing: Drawing, id: string): DrawnShape {
  const shape = drawing.shapes.find((candidate) => candidate.id === id);
  if (!shape) throw new Error(`no shape ${id}`);
  return shape;
}

describe('describeDiagram on the university fixture', () => {
  const drawing = describeDiagram(university());
  const document = university();

  it('draws one shape per element', () => {
    const elements =
      document.model.entities.length +
      document.model.relationships.length +
      document.model.attributes.length;
    expect(drawing.shapes).toHaveLength(elements);
  });

  it('doubles a weak entity, an identifying relationship and a multivalued attribute', () => {
    expect(shapeFor(drawing, 'ent_course').inner).not.toBeNull();
    expect(shapeFor(drawing, 'rel_offers').inner).not.toBeNull();
    expect(shapeFor(drawing, 'at_student_email').inner).not.toBeNull();
  });

  it('draws everything else with a single outline', () => {
    expect(shapeFor(drawing, 'ent_student').inner).toBeNull();
    expect(shapeFor(drawing, 'rel_enrolls').inner).toBeNull();
    expect(shapeFor(drawing, 'at_student_id').inner).toBeNull();
  });

  it('dashes a derived attribute only', () => {
    expect(shapeFor(drawing, 'at_student_age').dashed).toBe(true);
    expect(drawing.shapes.filter((shape) => shape.dashed)).toHaveLength(1);
  });

  it('underlines a key solidly and a partial key with a dashed rule', () => {
    expect(shapeFor(drawing, 'at_student_id').underline).toBe('solid');
    expect(shapeFor(drawing, 'at_course_code').underline).toBe('dashed');
    expect(shapeFor(drawing, 'at_student_email').underline).toBe('none');
  });

  it('crowns a primary key and plugs a foreign key, but not a partial key', () => {
    expect(shapeFor(drawing, 'at_student_id').markers).toEqual(['key']);
    expect(shapeFor(drawing, 'at_student_dept').markers).toEqual(['foreign']);
    expect(shapeFor(drawing, 'at_course_code').markers).toEqual([]);
  });

  it('draws 15 attribute lines and 11 relationship-end lines', () => {
    // offers has two total ends at two lines each; enrolls 2, takes 3, supervises 2.
    expect(drawing.lines).toHaveLength(15 + 4 + 2 + 3 + 2);
  });

  it('labels every end with its cardinality, and the two self-relationship ends with roles', () => {
    const cardinalities = drawing.labels.filter((label) => label.kind === 'cardinality');
    const roles = drawing.labels.filter((label) => label.kind === 'role');
    expect(cardinalities).toHaveLength(9);
    expect(roles.map((label) => label.text).sort()).toEqual(['supervisee', 'supervisor']);
  });

  it('keeps the two supervises ends apart instead of on top of each other', () => {
    const roles = drawing.labels.filter((label) => label.kind === 'role');
    const [first, second] = roles;
    expect(
      distance(first?.position ?? { x: 0, y: 0 }, second?.position ?? { x: 0, y: 0 }),
    ).toBeGreaterThan(40);
  });

  it('carries colour overrides and leaves the rest to the ink', () => {
    expect(shapeFor(drawing, 'ent_student').color).toBe('#2563eb');
    expect(shapeFor(drawing, 'ent_department').color).toBeNull();
  });

  it('bounds every shape', () => {
    const shapesOnly = unionBounds(drawing.shapes.map((shape) => boundsOf(shape.box)));
    expect(drawing.bounds?.minX).toBeLessThanOrEqual(shapesOnly?.minX ?? 0);
    expect(drawing.bounds?.maxY).toBeGreaterThanOrEqual(shapesOnly?.maxY ?? 0);
  });

  it('never changes the document it describes', () => {
    const before = university();
    const snapshot = structuredClone(before);
    describeDiagram(before);
    expect(before).toEqual(snapshot);
  });
});

describe('describeDiagram edge cases', () => {
  it('describes an empty diagram as nothing, with no bounds', () => {
    expect(describeDiagram(createEmptyDocument())).toEqual({
      shapes: [],
      lines: [],
      labels: [],
      bounds: null,
    });
  });

  it('shows an undecided cardinality as a placeholder', () => {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'a', name: 'A', position: { x: 0, y: 0 } });
    document = addEntity(document, { id: 'b', name: 'B', position: { x: 600, y: 0 } });
    document = addRelationship(document, {
      id: 'r',
      name: 'r',
      entityIds: ['a', 'b'],
      position: { x: 300, y: 0 },
    });
    const labels = describeDiagram(document).labels;
    expect(labels.every((label) => label.text === CARDINALITY_PLACEHOLDER && label.unset)).toBe(
      true,
    );
  });

  it('grows the bounds to include a marker that sticks out above a shape', () => {
    let document = createEmptyDocument();
    document = addEntity(document, { id: 'a', name: 'A', position: { x: 0, y: 200 } });
    document = addAttribute(document, {
      id: 'k',
      ownerId: 'a',
      name: 'k',
      identifier: 'key',
      offset: { x: 0, y: -200 },
    });
    document = setAttributeForeignKey(document, 'k', true);

    const drawing = describeDiagram(document);
    const shapesOnly = unionBounds(drawing.shapes.map((shape) => boundsOf(shape.box)));
    expect(drawing.bounds?.minY).toBeLessThan(shapesOnly?.minY ?? 0);
    expect(shapeFor(drawing, 'k').markers).toEqual(['key', 'foreign']);
  });

  it('skips a line and labels whose shapes cannot be placed', () => {
    const base = addEntity(createEmptyDocument(), {
      id: 'a',
      name: 'A',
      position: { x: 0, y: 0 },
    });
    const document: ErDocument = {
      ...base,
      model: {
        ...base.model,
        attributes: [
          {
            id: 'orphan',
            ownerId: 'ghost',
            ownerKind: 'entity',
            name: 'x',
            shape: 'simple',
            identifier: 'none',
            foreignKey: false,
          },
        ],
        relationships: [
          {
            id: 'r',
            name: 'r',
            kind: 'regular',
            ends: [
              { entityId: 'a', cardinality: '1', participation: 'partial', role: null },
              { entityId: 'ghost', cardinality: 'N', participation: 'partial', role: null },
            ],
          },
        ],
      },
    };
    const drawing = describeDiagram(document);
    expect(drawing.shapes.map((shape) => shape.id).sort()).toEqual(['a', 'r']);
    // Only the end whose entity exists gets a line and a label.
    expect(drawing.lines).toHaveLength(1);
    expect(drawing.labels).toHaveLength(1);
  });

  it('carries a colour set on a single component', () => {
    const base = addEntity(createEmptyDocument(), { id: 'a', name: 'A', position: { x: 0, y: 0 } });
    const withColour = setElementColor(base, 'a', '#dc2626');
    const drawing = describeDiagram(withColour);
    expect(shapeFor(drawing, 'a').color).toBe('#dc2626');
  });
});
