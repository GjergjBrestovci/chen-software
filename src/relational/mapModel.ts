import { messages } from '../i18n/messages.en';
import { createColumnSpec, isIntegerType, takesLength, takesPrecision } from '../model/column';
import { attributesOf, findEntity } from '../model/queries';
import type {
  Attribute,
  ColumnSpec,
  Entity,
  ErModel,
  Id,
  Relationship,
  RelationshipEnd,
} from '../model/types';
import { NameSet } from './naming';
import type { Column, RelationalSchema, Table } from './types';

/**
 * Maps an ER model to tables, the textbook way:
 *
 * - every entity becomes a table; its key attributes form the primary key,
 *   composites are flattened into their parts, and derived attributes are left
 *   out because they are computed rather than stored;
 * - a weak entity also takes its owners' keys, through its identifying
 *   relationship, and its rows are deleted with its owner's;
 * - a multivalued attribute becomes a table of its own;
 * - a binary relationship with a `1` end becomes a foreign key on the other
 *   side (UNIQUE when both ends are `1`); any other relationship becomes a
 *   table of foreign keys whose primary key leaves out one `1` end.
 *
 * It never refuses. A diagram mid-assignment still exports (SPEC.md §1,
 * product rule 4), and every guess made about it is recorded as a note.
 */

const text = messages.sql;

/** A column the student marked as a foreign key, still to be constrained. */
interface HandForeignKey {
  table: Table;
  column: Column;
  attribute: Attribute;
}

interface ForeignKeyOptions {
  /** Put before each referenced column name, e.g. a role: `supervisor_emp_id`. */
  prefix: string | null;
  notNull: boolean;
  onDeleteCascade: boolean;
}

/** Only the parts of a column spec that say what type it is. */
function typeOnly(spec: ColumnSpec): ColumnSpec {
  return {
    ...createColumnSpec(),
    type: spec.type,
    length: spec.length,
    precision: spec.precision,
    scale: spec.scale,
  };
}

function sameType(a: ColumnSpec, b: ColumnSpec): boolean {
  if (a.type !== b.type) return false;
  if (a.type === null) return true;
  if (takesLength(a.type)) return a.length === b.length;
  if (takesPrecision(a.type)) return a.precision === b.precision && a.scale === b.scale;
  return true;
}

function sameColumns(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a.map((name) => name.toLowerCase()));
  return a.length === b.length && b.every((name) => set.has(name.toLowerCase()));
}

function nameOr(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function qualified(table: Table, column: Column): string {
  return `${table.name}.${column.name}`;
}

class SchemaBuilder {
  readonly notes: string[] = [];

  private readonly tableNames = new NameSet();
  private readonly columnNames = new Map<Table, NameSet>();
  private readonly entityTables = new Map<Id, Table>();
  /** Entity and relationship tables, in model order. */
  private readonly mainTables: Table[] = [];
  /** Multivalued-attribute tables, listed after the table they belong to. */
  private readonly childTables = new Map<Table, Table[]>();
  private readonly pendingMultivalued: { host: Table; attribute: Attribute }[] = [];
  private readonly handForeignKeys: HandForeignKey[] = [];
  private readonly claimed = new Set<Column>();
  private readonly keyed = new Set<Id>();
  private readonly keying = new Set<Id>();

  constructor(private readonly model: ErModel) {}

  build(): RelationalSchema {
    for (const entity of this.model.entities) {
      this.addEntityTable(entity);
    }
    for (const entity of this.model.entities) {
      this.resolveKey(entity);
    }
    for (const relationship of this.model.relationships) {
      this.addRelationship(relationship);
    }
    for (const { host, attribute } of this.pendingMultivalued) {
      this.addMultivaluedTable(host, attribute);
    }
    for (const handForeignKey of this.handForeignKeys) {
      if (!this.claimed.has(handForeignKey.column)) {
        this.constrainHandForeignKey(handForeignKey);
      }
    }

    const tables = this.mainTables.flatMap((table) => [
      table,
      ...(this.childTables.get(table) ?? []),
    ]);
    for (const table of tables) {
      this.finish(table);
    }
    return { tables, notes: this.notes };
  }

  // Tables and columns --------------------------------------------------------

  private createTable(wanted: string, sourceId: Id, reportClash = true): Table {
    const name = this.tableNames.claim(wanted);
    if (reportClash && name.toLowerCase() !== wanted.toLowerCase()) {
      this.notes.push(text.duplicateTable(wanted, name));
    }
    return { name, sourceId, columns: [], primaryKey: [], uniques: [], foreignKeys: [] };
  }

  /** Names a table after an element, inventing a name if it has none. */
  private createNamedTable(
    name: string,
    sourceId: Id,
    unnamedNote: (name: string) => string,
  ): Table {
    if (name.trim().length > 0) {
      return this.createTable(name.trim(), sourceId);
    }
    // Several placeholders numbering themselves is expected, not a clash.
    const table = this.createTable(text.unnamedTable, sourceId, false);
    this.notes.push(unnamedNote(table.name));
    return table;
  }

  private namesOf(table: Table): NameSet {
    const names = this.columnNames.get(table) ?? new NameSet();
    this.columnNames.set(table, names);
    return names;
  }

  private addColumn(table: Table, wanted: string, details: Omit<Column, 'name'>): Column {
    const column: Column = { name: this.namesOf(table).claim(wanted), ...details };
    table.columns.push(column);
    return column;
  }

  private addAttributeColumn(table: Table, attribute: Attribute, isKey: boolean): Column {
    const named = attribute.name.trim().length > 0;
    const column = this.addColumn(table, nameOr(attribute.name, text.unnamedColumn), {
      spec: attribute.column,
      notNull: isKey || attribute.column.notNull,
      autoIncrement: attribute.column.autoIncrement,
      defaultValue: attribute.column.defaultValue,
    });
    if (!named) {
      this.notes.push(text.unnamedAttribute(qualified(table, column)));
    }
    if (isKey) {
      table.primaryKey.push(column.name);
    }
    if (attribute.column.unique) {
      table.uniques.push([column.name]);
    }
    if (attribute.foreignKey) {
      this.handForeignKeys.push({ table, column, attribute });
    }
    return column;
  }

  /**
   * Adds the columns of every attribute under `ownerId`: composites become
   * their parts, multivalued attributes are set aside for their own table, and
   * derived attributes are left out.
   */
  private addAttributes(table: Table, ownerId: Id, keysAllowed: boolean, partOfKey = false): void {
    for (const attribute of attributesOf(this.model, ownerId)) {
      const isKey = keysAllowed && (partOfKey || attribute.identifier !== 'none');
      const hasParts = attributesOf(this.model, attribute.id).length > 0;

      if (attribute.shape === 'derived') {
        this.notes.push(
          text.derivedLeftOut(nameOr(attribute.name, messages.element.unnamed), table.name),
        );
      } else if (attribute.shape === 'multivalued') {
        this.pendingMultivalued.push({ host: table, attribute });
      } else if (attribute.shape === 'composite' && hasParts) {
        this.addAttributes(table, attribute.id, keysAllowed, isKey);
      } else {
        // A composite with no parts yet is still a value the student wants kept.
        this.addAttributeColumn(table, attribute, isKey);
      }
    }
  }

  /** Adds columns referencing `target`'s primary key, and the constraint. */
  private addForeignKey(table: Table, target: Table, options: ForeignKeyOptions): Column[] {
    const columns = target.primaryKey.map((keyName) => {
      const referenced = target.columns.find((column) => column.name === keyName);
      const wanted =
        options.prefix !== null
          ? `${options.prefix}_${keyName}`
          : this.namesOf(table).has(keyName)
            ? `${target.name.toLowerCase()}_${keyName}`
            : keyName;
      return this.addColumn(table, wanted, {
        spec: referenced ? typeOnly(referenced.spec) : createColumnSpec(),
        notNull: options.notNull,
        autoIncrement: false,
        defaultValue: null,
      });
    });

    table.foreignKeys.push({
      columns: columns.map((column) => column.name),
      table: target.name,
      referencedColumns: [...target.primaryKey],
      onDeleteCascade: options.onDeleteCascade,
    });
    return columns;
  }

  private tableOf(entityId: Id): Table {
    const table = this.entityTables.get(entityId);
    if (!table) {
      // Relationship ends are checked against the entities on import.
      throw new Error(`No table for entity "${entityId}".`);
    }
    return table;
  }

  // Entities ------------------------------------------------------------------

  private addEntityTable(entity: Entity): void {
    const table = this.createNamedTable(entity.name, entity.id, text.unnamedEntity);
    this.entityTables.set(entity.id, table);
    this.mainTables.push(table);
    this.addAttributes(table, entity.id, true);
  }

  /**
   * The weak entity an identifying relationship identifies, if it has one.
   * Between two weak entities, as in a chain, the owner is the `1` end.
   */
  private identifiedBy(relationship: Relationship): Id | undefined {
    if (relationship.kind !== 'identifying') {
      return undefined;
    }
    const weakEnds = relationship.ends.filter(
      (end) => findEntity(this.model, end.entityId)?.kind === 'weak',
    );
    return (weakEnds.find((end) => end.cardinality !== '1') ?? weakEnds[0])?.entityId;
  }

  private ownersOf(weakId: Id): Entity[] {
    const owners = new Map<Id, Entity>();
    for (const relationship of this.model.relationships) {
      if (this.identifiedBy(relationship) !== weakId) continue;
      for (const end of relationship.ends) {
        const owner = findEntity(this.model, end.entityId);
        if (owner && owner.id !== weakId) {
          owners.set(owner.id, owner);
        }
      }
    }
    return [...owners.values()];
  }

  /**
   * Settles an entity's primary key. A weak entity's key starts with its
   * owners' keys, so owners are settled first; a chain of weak entities is
   * followed as far as it goes.
   */
  private resolveKey(entity: Entity): void {
    if (this.keyed.has(entity.id)) return;
    this.keying.add(entity.id);
    const table = this.tableOf(entity.id);
    const leading: Column[] = [];

    if (entity.kind === 'weak') {
      const owners = this.ownersOf(entity.id);
      if (owners.length === 0) {
        this.notes.push(text.weakWithoutOwner(table.name));
      }
      for (const owner of owners) {
        if (this.keying.has(owner.id)) {
          this.notes.push(text.ownerCycle(table.name, this.tableOf(owner.id).name));
          continue;
        }
        this.resolveKey(owner);
        leading.push(
          ...this.addForeignKey(table, this.tableOf(owner.id), {
            prefix: null,
            notNull: true,
            onDeleteCascade: true,
          }),
        );
      }
    }

    if (leading.length === 0 && table.primaryKey.length === 0) {
      leading.push(
        this.addColumn(table, text.generatedKey, {
          spec: { ...createColumnSpec(), type: 'INT' },
          notNull: true,
          autoIncrement: true,
          defaultValue: null,
        }),
      );
      this.notes.push(text.generatedPrimaryKey(table.name));
    }

    const leadingNames = leading.map((column) => column.name);
    table.primaryKey = [...leadingNames, ...table.primaryKey];
    table.columns = [...leading, ...table.columns.filter((column) => !leading.includes(column))];

    this.keying.delete(entity.id);
    this.keyed.add(entity.id);
  }

  // Relationships -------------------------------------------------------------

  private endName(end: RelationshipEnd): string {
    return this.tableOf(end.entityId).name;
  }

  private addRelationship(relationship: Relationship): void {
    const weakId = this.identifiedBy(relationship);
    if (weakId !== undefined) {
      // Already expressed by the weak entity's key; only its attributes remain.
      this.addAttributes(this.tableOf(weakId), relationship.id, false);
      return;
    }

    const [first, second] = relationship.ends;
    const binaryWithOne =
      relationship.ends.length === 2 &&
      first !== undefined &&
      second !== undefined &&
      (first.cardinality === '1' || second.cardinality === '1');

    // Named after its table when it has one, so the note matches the SQL.
    const label = binaryWithOne
      ? nameOr(relationship.name, text.unnamedRelationshipLabel)
      : this.addRelationshipTable(relationship).name;
    for (const end of relationship.ends) {
      if (end.cardinality === null) {
        this.notes.push(text.missingCardinality(label, this.endName(end)));
      }
    }
    if (binaryWithOne) {
      this.addBinaryForeignKey(relationship, first, second);
    }
  }

  /** 1:N puts the key on the N side; 1:1 on a side that must take part. */
  private addBinaryForeignKey(
    relationship: Relationship,
    first: RelationshipEnd,
    second: RelationshipEnd,
  ): void {
    const oneToOne = first.cardinality === '1' && second.cardinality === '1';
    const holder = oneToOne
      ? first.participation === 'total' && second.participation !== 'total'
        ? first
        : second
      : first.cardinality === '1'
        ? second
        : first;
    const target = holder === first ? second : first;

    const holderTable = this.tableOf(holder.entityId);
    const targetTable = this.tableOf(target.entityId);
    const notNull = holder.participation === 'total';
    const role = target.role?.trim() ?? '';
    const prefix =
      role.length > 0
        ? role
        : holder.entityId === target.entityId && relationship.name.trim().length > 0
          ? relationship.name.trim()
          : null;

    const columns =
      this.reuseHandForeignKey(holderTable, target.entityId, notNull) ??
      this.addForeignKey(holderTable, targetTable, { prefix, notNull, onDeleteCascade: false });

    if (oneToOne) {
      holderTable.uniques.push(columns.map((column) => column.name));
    }
    this.addAttributes(holderTable, relationship.id, false);
  }

  /**
   * M:N, ternary and higher: a table of foreign keys. Its primary key leaves
   * out one `1` end, because the other ends already determine it; every other
   * `1` end gives an alternative key, which becomes a UNIQUE constraint.
   */
  private addRelationshipTable(relationship: Relationship): Table {
    const table = this.createNamedTable(
      relationship.name,
      relationship.id,
      text.unnamedRelationship,
    );
    this.mainTables.push(table);

    const endColumns = relationship.ends.map((end) => {
      const role = end.role?.trim() ?? '';
      return this.addForeignKey(table, this.tableOf(end.entityId), {
        prefix: role.length > 0 ? role : null,
        notNull: true,
        onDeleteCascade: false,
      }).map((column) => column.name);
    });

    const oneEnds = relationship.ends.flatMap((end, index) =>
      end.cardinality === '1' ? [index] : [],
    );
    const keyWithout = (left: number | undefined): string[] =>
      endColumns.filter((_, index) => index !== left).flat();

    table.primaryKey = keyWithout(oneEnds[0]);
    for (const index of oneEnds.slice(1)) {
      table.uniques.push(keyWithout(index));
    }
    this.addAttributes(table, relationship.id, false);
    return table;
  }

  private addMultivaluedTable(host: Table, attribute: Attribute): void {
    const table = this.createTable(
      `${host.name}_${nameOr(attribute.name, text.unnamedColumn)}`,
      attribute.id,
    );
    const siblings = this.childTables.get(host) ?? [];
    this.childTables.set(host, [...siblings, table]);

    const ownerColumns = this.addForeignKey(table, host, {
      prefix: null,
      notNull: true,
      onDeleteCascade: true,
    });
    this.addAttributeColumn(table, attribute, true);
    table.primaryKey = [...ownerColumns.map((column) => column.name), ...table.primaryKey];
  }

  // Foreign keys the student marked -------------------------------------------

  /**
   * A relationship that needs a key to `targetId` uses the column the student
   * already marked for it, instead of adding a second one beside it.
   */
  private reuseHandForeignKey(table: Table, targetId: Id, notNull: boolean): Column[] | null {
    const target = this.tableOf(targetId);
    if (target.primaryKey.length !== 1) return null;

    const match = this.handForeignKeys.find(
      (candidate) =>
        candidate.table === table &&
        candidate.attribute.column.references === targetId &&
        !this.claimed.has(candidate.column),
    );
    if (!match) return null;

    match.column.notNull ||= notNull;
    this.constrainHandForeignKey(match);
    return [match.column];
  }

  private constrainHandForeignKey({ table, column, attribute }: HandForeignKey): void {
    this.claimed.add(column);
    const targetId = attribute.column.references;
    const name = qualified(table, column);
    if (targetId === null) {
      this.notes.push(text.foreignKeyWithoutTarget(name));
      return;
    }

    const target = this.tableOf(targetId);
    const [keyName, ...rest] = target.primaryKey;
    const referenced = target.columns.find((candidate) => candidate.name === keyName);
    if (keyName === undefined || rest.length > 0 || !referenced) {
      this.notes.push(text.foreignKeyToCompositeKey(name, target.name));
      return;
    }

    if (column.spec.type !== null && !sameType(column.spec, referenced.spec)) {
      this.notes.push(text.foreignKeyTypeMatched(name, target.name));
    }
    column.spec = { ...column.spec, ...typeOnly(referenced.spec) };
    table.foreignKeys.push({
      columns: [column.name],
      table: target.name,
      referencedColumns: [keyName],
      onDeleteCascade: false,
    });
  }

  // Tidying -------------------------------------------------------------------

  private finish(table: Table): void {
    for (const column of table.columns) {
      if (!column.autoIncrement) continue;
      const soleKey = table.primaryKey.length === 1 && table.primaryKey[0] === column.name;
      if (!soleKey || column.spec.type === null || !isIntegerType(column.spec.type)) {
        column.autoIncrement = false;
        this.notes.push(text.autoIncrementIgnored(qualified(table, column)));
      }
    }

    const uniques: string[][] = [];
    for (const unique of table.uniques) {
      const redundant =
        sameColumns(unique, table.primaryKey) ||
        uniques.some((existing) => sameColumns(existing, unique));
      if (!redundant) {
        uniques.push(unique);
      }
    }
    table.uniques = uniques;
  }
}

export function mapModel(model: ErModel): RelationalSchema {
  return new SchemaBuilder(model).build();
}
