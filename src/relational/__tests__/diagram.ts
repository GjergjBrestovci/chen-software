import {
  addAttribute,
  addEntity,
  addRelationship,
  createEmptyDocument,
  setAttributeColumn,
  setCardinality,
  setEndRole,
  setParticipation,
} from '../../model/operations';
import type {
  AttributeIdentifier,
  AttributeShape,
  Cardinality,
  ColumnSpec,
  EntityKind,
  ErDocument,
  ErModel,
  Id,
  Participation,
  RelationshipKind,
} from '../../model/types';
import type { Column, RelationalSchema, Table } from '../types';

/**
 * A small fluent builder for test diagrams, so each test states only the
 * modelling it is about. Ids double as names unless a name is given.
 */

const origin = { x: 0, y: 0 };

export interface AttributeOptions {
  name?: string;
  shape?: AttributeShape;
  identifier?: AttributeIdentifier;
  foreignKey?: boolean;
  column?: Partial<ColumnSpec>;
}

export interface EndOptions {
  cardinality?: Cardinality | null;
  participation?: Participation;
  role?: string;
}

export class Diagram {
  private document: ErDocument = createEmptyDocument();

  entity(id: Id, kind: EntityKind = 'regular', name: string = id): this {
    this.document = addEntity(this.document, { id, name, position: origin, kind });
    return this;
  }

  attribute(id: Id, ownerId: Id, options: AttributeOptions = {}): this {
    this.document = addAttribute(this.document, {
      id,
      ownerId,
      name: options.name ?? id,
      shape: options.shape ?? 'simple',
      identifier: options.identifier ?? 'none',
      foreignKey: options.foreignKey ?? false,
      offset: origin,
    });
    if (options.column) {
      this.document = setAttributeColumn(this.document, id, options.column);
    }
    return this;
  }

  key(id: Id, ownerId: Id, column: Partial<ColumnSpec> = { type: 'INT' }): this {
    return this.attribute(id, ownerId, { identifier: 'key', column });
  }

  relationship(
    id: Id,
    ends: readonly [Id, EndOptions][],
    kind: RelationshipKind = 'regular',
    name: string = id,
  ): this {
    this.document = addRelationship(this.document, {
      id,
      name,
      entityIds: ends.map(([entityId]) => entityId),
      position: origin,
      kind,
    });
    ends.forEach(([, options], endIndex) => {
      this.document = setCardinality(this.document, {
        relationshipId: id,
        endIndex,
        cardinality: options.cardinality === undefined ? 'N' : options.cardinality,
      });
      if (options.participation) {
        this.document = setParticipation(this.document, {
          relationshipId: id,
          endIndex,
          participation: options.participation,
        });
      }
      if (options.role !== undefined) {
        this.document = setEndRole(this.document, {
          relationshipId: id,
          endIndex,
          role: options.role,
        });
      }
    });
    return this;
  }

  get model(): ErModel {
    return this.document.model;
  }

  get doc(): ErDocument {
    return this.document;
  }
}

export function table(schema: RelationalSchema, name: string): Table {
  const found = schema.tables.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(
      `No table ${name}; have ${schema.tables.map((candidate) => candidate.name).join(', ')}`,
    );
  }
  return found;
}

export function column(owner: Table, name: string): Column {
  const found = owner.columns.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(
      `No column ${owner.name}.${name}; have ${owner.columns.map((c) => c.name).join(', ')}`,
    );
  }
  return found;
}

export function columnNames(owner: Table): string[] {
  return owner.columns.map((candidate) => candidate.name);
}
