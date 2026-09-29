import { describe, expect, it } from 'vitest';
import { messages } from '../../i18n/messages.en';
import { mapModel } from '../mapModel';
import { column, columnNames, Diagram, table } from './diagram';

const text = messages.sql;

describe('entities', () => {
  it('becomes a table with a column per attribute, in model order', () => {
    const schema = mapModel(
      new Diagram()
        .entity('BOOK')
        .key('isbn', 'BOOK', { type: 'CHAR', length: 13 })
        .attribute('title', 'BOOK', { column: { type: 'VARCHAR', length: 200, notNull: true } })
        .attribute('pages', 'BOOK').model,
    );
    const book = table(schema, 'BOOK');
    expect(columnNames(book)).toEqual(['isbn', 'title', 'pages']);
    expect(book.primaryKey).toEqual(['isbn']);
    expect(column(book, 'isbn')).toMatchObject({ notNull: true });
    expect(column(book, 'title')).toMatchObject({ notNull: true });
    expect(column(book, 'pages')).toMatchObject({ notNull: false });
    expect(column(book, 'title').spec).toMatchObject({ type: 'VARCHAR', length: 200 });
    expect(schema.notes).toEqual([]);
  });

  it('makes several key attributes one composite primary key', () => {
    const schema = mapModel(
      new Diagram().entity('FLIGHT').key('airline', 'FLIGHT').key('number', 'FLIGHT').model,
    );
    expect(table(schema, 'FLIGHT').primaryKey).toEqual(['airline', 'number']);
  });

  it('flattens a composite into its parts, keyed as a whole when it is a key', () => {
    const schema = mapModel(
      new Diagram()
        .entity('PERSON')
        .attribute('name', 'PERSON', { shape: 'composite', identifier: 'key' })
        .attribute('first', 'name')
        .attribute('last', 'name').model,
    );
    const person = table(schema, 'PERSON');
    expect(columnNames(person)).toEqual(['first', 'last']);
    expect(person.primaryKey).toEqual(['first', 'last']);
  });

  it('keeps a composite with no parts yet as a column of its own', () => {
    const schema = mapModel(
      new Diagram()
        .entity('PERSON')
        .key('id', 'PERSON')
        .attribute('address', 'PERSON', { shape: 'composite' }).model,
    );
    expect(columnNames(table(schema, 'PERSON'))).toEqual(['id', 'address']);
  });

  it('leaves out a derived attribute, and says so', () => {
    const schema = mapModel(
      new Diagram()
        .entity('PERSON')
        .key('id', 'PERSON')
        .attribute('age', 'PERSON', { shape: 'derived' }).model,
    );
    expect(columnNames(table(schema, 'PERSON'))).toEqual(['id']);
    expect(schema.notes).toEqual([text.derivedLeftOut('age', 'PERSON')]);
  });

  it('generates a primary key for an entity with no key attribute', () => {
    const schema = mapModel(new Diagram().entity('THING').attribute('label', 'THING').model);
    const thing = table(schema, 'THING');
    expect(columnNames(thing)).toEqual(['id', 'label']);
    expect(thing.primaryKey).toEqual(['id']);
    expect(column(thing, 'id')).toMatchObject({ autoIncrement: true, notNull: true });
    expect(column(thing, 'id').spec.type).toBe('INT');
    expect(schema.notes).toEqual([text.generatedPrimaryKey('THING')]);
  });

  it('keeps UNIQUE on an attribute, but not when it repeats the primary key', () => {
    const schema = mapModel(
      new Diagram()
        .entity('USER')
        .key('id', 'USER', { type: 'INT', unique: true })
        .attribute('email', 'USER', { column: { unique: true } }).model,
    );
    expect(table(schema, 'USER').uniques).toEqual([['email']]);
  });

  it('keeps AUTO_INCREMENT only on a single whole-number primary key', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('id', 'A', { type: 'INT', autoIncrement: true })
        .entity('B')
        .key('code', 'B', { type: 'VARCHAR', length: 5, autoIncrement: true })
        .entity('C')
        .key('x', 'C', { type: 'INT', autoIncrement: true })
        .key('y', 'C', { type: 'INT' })
        .attribute('counter', 'C', { column: { type: 'INT', autoIncrement: true } }).model,
    );
    expect(column(table(schema, 'A'), 'id').autoIncrement).toBe(true);
    expect(column(table(schema, 'B'), 'code').autoIncrement).toBe(false);
    expect(column(table(schema, 'C'), 'x').autoIncrement).toBe(false);
    expect(column(table(schema, 'C'), 'counter').autoIncrement).toBe(false);
    expect(schema.notes).toEqual([
      text.autoIncrementIgnored('B.code'),
      text.autoIncrementIgnored('C.x'),
      text.autoIncrementIgnored('C.counter'),
    ]);
  });
});

describe('names', () => {
  it('invents a name for an unnamed entity or attribute, and says so', () => {
    const schema = mapModel(
      new Diagram().entity('e', 'regular', '  ').key('k', 'e').attribute('a', 'e', { name: '' })
        .model,
    );
    const unnamed = table(schema, text.unnamedTable);
    expect(columnNames(unnamed)).toEqual(['k', text.unnamedColumn]);
    expect(schema.notes).toEqual([
      text.unnamedEntity(text.unnamedTable),
      text.unnamedAttribute(`${text.unnamedTable}.${text.unnamedColumn}`),
    ]);
  });

  it('numbers placeholders without calling it a clash', () => {
    const schema = mapModel(
      new Diagram()
        .entity('a', 'regular', '')
        .key('ka', 'a')
        .entity('b', 'regular', '')
        .key('kb', 'b').model,
    );
    expect(schema.tables.map((t) => t.name)).toEqual([text.unnamedTable, `${text.unnamedTable}_2`]);
    expect(schema.notes).toEqual([
      text.unnamedEntity(text.unnamedTable),
      text.unnamedEntity(`${text.unnamedTable}_2`),
    ]);
  });

  it('renames a second table with the same name, ignoring case, and says so', () => {
    const schema = mapModel(
      new Diagram()
        .entity('a', 'regular', 'Book')
        .key('ka', 'a')
        .entity('b', 'regular', 'BOOK')
        .key('kb', 'b').model,
    );
    expect(schema.tables.map((t) => t.name)).toEqual(['Book', 'BOOK_2']);
    expect(schema.notes).toEqual([text.duplicateTable('BOOK', 'BOOK_2')]);
  });

  it('trims surrounding spaces from names', () => {
    const schema = mapModel(new Diagram().entity('b', 'regular', ' BOOK ').key('isbn', 'b').model);
    expect(schema.tables.map((t) => t.name)).toEqual(['BOOK']);
  });
});

describe('multivalued attributes', () => {
  it('get a table of their own, straight after their owner', () => {
    const schema = mapModel(
      new Diagram()
        .entity('STUDENT')
        .key('student_id', 'STUDENT')
        .attribute('email', 'STUDENT', {
          shape: 'multivalued',
          column: { type: 'VARCHAR', length: 254 },
        })
        .entity('COURSE')
        .key('code', 'COURSE').model,
    );
    expect(schema.tables.map((t) => t.name)).toEqual(['STUDENT', 'STUDENT_email', 'COURSE']);
    expect(columnNames(table(schema, 'STUDENT'))).toEqual(['student_id']);

    const emails = table(schema, 'STUDENT_email');
    expect(columnNames(emails)).toEqual(['student_id', 'email']);
    expect(emails.primaryKey).toEqual(['student_id', 'email']);
    expect(column(emails, 'email').spec).toMatchObject({ type: 'VARCHAR', length: 254 });
    expect(emails.foreignKeys).toEqual([
      {
        columns: ['student_id'],
        table: 'STUDENT',
        referencedColumns: ['student_id'],
        onDeleteCascade: true,
      },
    ]);
  });

  it('reference a generated key when the owner has none', () => {
    const schema = mapModel(
      new Diagram().entity('THING').attribute('tag', 'THING', { shape: 'multivalued' }).model,
    );
    expect(table(schema, 'THING_tag').primaryKey).toEqual(['id', 'tag']);
  });

  it('on a relationship hang off the table that holds the relationship', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship('links', [
          ['A', {}],
          ['B', {}],
        ])
        .attribute('note', 'links', { shape: 'multivalued' }).model,
    );
    const notes = table(schema, 'links_note');
    expect(columnNames(notes)).toEqual(['a_id', 'b_id', 'note']);
    expect(notes.foreignKeys[0]).toMatchObject({
      table: 'links',
      referencedColumns: ['a_id', 'b_id'],
    });
  });

  it('as an unnamed attribute still get a table', () => {
    const schema = mapModel(
      new Diagram()
        .entity('T')
        .key('id', 'T')
        .attribute('m', 'T', { name: '', shape: 'multivalued' }).model,
    );
    expect(table(schema, `T_${text.unnamedColumn}`).primaryKey).toEqual(['id', text.unnamedColumn]);
  });
});

describe('weak entities', () => {
  function university(): Diagram {
    return new Diagram()
      .entity('DEPARTMENT')
      .key('dept_id', 'DEPARTMENT', { type: 'INT', autoIncrement: true })
      .entity('COURSE', 'weak')
      .attribute('code', 'COURSE', {
        identifier: 'partial',
        column: { type: 'VARCHAR', length: 10 },
      })
      .attribute('title', 'COURSE')
      .relationship(
        'offers',
        [
          ['DEPARTMENT', { cardinality: '1', participation: 'total' }],
          ['COURSE', { cardinality: 'N', participation: 'total' }],
        ],
        'identifying',
      );
  }

  it('take their owner key first, then their partial key', () => {
    const schema = mapModel(university().model);
    const course = table(schema, 'COURSE');
    expect(columnNames(course)).toEqual(['dept_id', 'code', 'title']);
    expect(course.primaryKey).toEqual(['dept_id', 'code']);
    expect(course.foreignKeys).toEqual([
      {
        columns: ['dept_id'],
        table: 'DEPARTMENT',
        referencedColumns: ['dept_id'],
        onDeleteCascade: true,
      },
    ]);
  });

  it('copy the owner key type, without its AUTO_INCREMENT', () => {
    const course = table(mapModel(university().model), 'COURSE');
    expect(column(course, 'dept_id').spec.type).toBe('INT');
    expect(column(course, 'dept_id').autoIncrement).toBe(false);
  });

  it('absorb the identifying relationship, which gets no table, and its attributes', () => {
    const schema = mapModel(university().attribute('since', 'offers').model);
    expect(schema.tables.map((t) => t.name)).toEqual(['DEPARTMENT', 'COURSE']);
    expect(columnNames(table(schema, 'COURSE'))).toEqual(['dept_id', 'code', 'title', 'since']);
  });

  it('follow a chain of weak entities', () => {
    const schema = mapModel(
      university()
        .entity('SECTION', 'weak')
        .attribute('number', 'SECTION', { identifier: 'partial' })
        .relationship(
          'has',
          [
            ['COURSE', { cardinality: '1' }],
            ['SECTION', {}],
          ],
          'identifying',
        ).model,
    );
    const section = table(schema, 'SECTION');
    expect(section.primaryKey).toEqual(['dept_id', 'code', 'number']);
    expect(section.foreignKeys[0]).toMatchObject({
      columns: ['dept_id', 'code'],
      table: 'COURSE',
      referencedColumns: ['dept_id', 'code'],
    });
  });

  it('settle an owner declared after them', () => {
    const schema = mapModel(
      new Diagram()
        .entity('ROOM', 'weak')
        .attribute('number', 'ROOM', { identifier: 'partial' })
        .entity('BUILDING')
        .key('name', 'BUILDING')
        .relationship(
          'in',
          [
            ['BUILDING', { cardinality: '1' }],
            ['ROOM', {}],
          ],
          'identifying',
        ).model,
    );
    expect(table(schema, 'ROOM').primaryKey).toEqual(['name', 'number']);
  });

  it('keep only their own key when nothing identifies them, and say so', () => {
    const schema = mapModel(
      new Diagram().entity('ORPHAN', 'weak').attribute('n', 'ORPHAN', { identifier: 'partial' })
        .model,
    );
    expect(table(schema, 'ORPHAN').primaryKey).toEqual(['n']);
    expect(schema.notes).toEqual([text.weakWithoutOwner('ORPHAN')]);
  });

  it('with no partial key are keyed by their owner alone', () => {
    const schema = mapModel(
      new Diagram()
        .entity('P')
        .key('p_id', 'P')
        .entity('W', 'weak')
        .relationship(
          'owns',
          [
            ['P', { cardinality: '1' }],
            ['W', {}],
          ],
          'identifying',
        ).model,
    );
    expect(table(schema, 'W').primaryKey).toEqual(['p_id']);
  });

  it('that identify each other break the cycle, and say so', () => {
    const schema = mapModel(
      new Diagram()
        .entity('X', 'weak')
        .attribute('x', 'X', { identifier: 'partial' })
        .entity('Y', 'weak')
        .attribute('y', 'Y', { identifier: 'partial' })
        .relationship(
          'xy',
          [
            ['X', { cardinality: '1' }],
            ['Y', {}],
          ],
          'identifying',
        )
        .relationship(
          'yx',
          [
            ['Y', { cardinality: '1' }],
            ['X', {}],
          ],
          'identifying',
        ).model,
    );
    expect(table(schema, 'X').primaryKey).toEqual(['y', 'x']);
    expect(table(schema, 'Y').primaryKey).toEqual(['y']);
    expect(schema.notes).toEqual([text.ownerCycle('Y', 'X')]);
  });

  it('are not involved when an identifying relationship connects no weak entity', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship(
          'r',
          [
            ['A', { cardinality: '1' }],
            ['B', {}],
          ],
          'identifying',
        ).model,
    );
    expect(columnNames(table(schema, 'B'))).toEqual(['b_id', 'a_id']);
  });
});

describe('binary relationships with a 1 end', () => {
  function publishing(publisherEnd: object, bookEnd: object, reversed = false): Diagram {
    const ends: [string, object][] = [
      ['PUBLISHER', { cardinality: '1', ...publisherEnd }],
      ['BOOK', { cardinality: 'N', ...bookEnd }],
    ];
    return new Diagram()
      .entity('PUBLISHER')
      .key('name', 'PUBLISHER', { type: 'VARCHAR', length: 100 })
      .entity('BOOK')
      .key('isbn', 'BOOK')
      .relationship('published_by', reversed ? [...ends].reverse() : ends)
      .attribute('since', 'published_by');
  }

  it('put a foreign key on the N side, with the relationship attributes', () => {
    const schema = mapModel(publishing({}, {}).model);
    expect(schema.tables.map((t) => t.name)).toEqual(['PUBLISHER', 'BOOK']);
    const book = table(schema, 'BOOK');
    expect(columnNames(book)).toEqual(['isbn', 'name', 'since']);
    expect(column(book, 'name').notNull).toBe(false);
    expect(column(book, 'name').spec).toMatchObject({ type: 'VARCHAR', length: 100 });
    expect(book.foreignKeys).toEqual([
      {
        columns: ['name'],
        table: 'PUBLISHER',
        referencedColumns: ['name'],
        onDeleteCascade: false,
      },
    ]);
    expect(book.uniques).toEqual([]);
  });

  it('do the same whichever end comes first', () => {
    const book = table(mapModel(publishing({}, {}, true).model), 'BOOK');
    expect(columnNames(book)).toEqual(['isbn', 'name', 'since']);
  });

  it('make the key NOT NULL when the N side must take part', () => {
    const book = table(mapModel(publishing({}, { participation: 'total' }).model), 'BOOK');
    expect(column(book, 'name').notNull).toBe(true);
  });

  it('prefix the key with the referenced table when its name is taken', () => {
    const schema = mapModel(
      publishing({}, {}).attribute('book_name', 'BOOK', { name: 'name' }).model,
    );
    expect(columnNames(table(schema, 'BOOK'))).toEqual(['isbn', 'name', 'publisher_name', 'since']);
  });

  it('name the key after the role on the 1 end', () => {
    const book = table(mapModel(publishing({ role: 'publisher' }, {}).model), 'BOOK');
    expect(columnNames(book)).toContain('publisher_name');
  });

  it('as 1:1 put a UNIQUE key on the side that must take part', () => {
    const schema = mapModel(
      new Diagram()
        .entity('PERSON')
        .key('person_id', 'PERSON')
        .entity('PASSPORT')
        .key('number', 'PASSPORT')
        .relationship('holds', [
          ['PERSON', { cardinality: '1' }],
          ['PASSPORT', { cardinality: '1', participation: 'total' }],
        ])
        .relationship(
          'backwards',
          [
            ['PASSPORT', { cardinality: '1', participation: 'total' }],
            ['PERSON', { cardinality: '1' }],
          ],
          'regular',
        ).model,
    );
    const passport = table(schema, 'PASSPORT');
    expect(column(passport, 'person_id').notNull).toBe(true);
    expect(passport.uniques).toContainEqual(['person_id']);
    expect(columnNames(table(schema, 'PERSON'))).toEqual(['person_id']);
  });

  it('as 1:1 with neither side required put the key on the second end', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship('r', [
          ['A', { cardinality: '1' }],
          ['B', { cardinality: '1' }],
        ]).model,
    );
    expect(table(schema, 'B').uniques).toEqual([['a_id']]);
    expect(columnNames(table(schema, 'A'))).toEqual(['a_id']);
  });

  it('on the same entity use the roles, or the relationship name', () => {
    const schema = mapModel(
      new Diagram()
        .entity('EMPLOYEE')
        .key('emp_id', 'EMPLOYEE')
        .relationship('supervises', [
          ['EMPLOYEE', { cardinality: '1', role: 'supervisor' }],
          ['EMPLOYEE', { cardinality: 'N', role: 'supervisee' }],
        ])
        .relationship('mentors', [
          ['EMPLOYEE', { cardinality: '1' }],
          ['EMPLOYEE', { cardinality: 'N' }],
        ]).model,
    );
    const employee = table(schema, 'EMPLOYEE');
    expect(columnNames(employee)).toEqual(['emp_id', 'supervisor_emp_id', 'mentors_emp_id']);
    expect(employee.foreignKeys.map((key) => key.table)).toEqual(['EMPLOYEE', 'EMPLOYEE']);
  });

  it('on the same entity with no names at all still get distinct columns', () => {
    const schema = mapModel(
      new Diagram()
        .entity('NODE')
        .key('id', 'NODE')
        .relationship(
          'r',
          [
            ['NODE', { cardinality: '1' }],
            ['NODE', {}],
          ],
          'regular',
          '',
        ).model,
    );
    expect(columnNames(table(schema, 'NODE'))).toEqual(['id', 'node_id']);
  });
});

describe('relationships that become tables', () => {
  it('M:N gets a table keyed by both sides, with its attributes', () => {
    const schema = mapModel(
      new Diagram()
        .entity('AUTHOR')
        .key('author_id', 'AUTHOR')
        .entity('BOOK')
        .key('isbn', 'BOOK', { type: 'CHAR', length: 13 })
        .relationship('writes', [
          ['AUTHOR', { cardinality: 'M' }],
          ['BOOK', { cardinality: 'N' }],
        ])
        .attribute('royalty', 'writes').model,
    );
    const writes = table(schema, 'writes');
    expect(columnNames(writes)).toEqual(['author_id', 'isbn', 'royalty']);
    expect(writes.primaryKey).toEqual(['author_id', 'isbn']);
    expect(column(writes, 'author_id').notNull).toBe(true);
    expect(column(writes, 'isbn').spec).toMatchObject({ type: 'CHAR', length: 13 });
    expect(writes.foreignKeys.map((key) => key.table)).toEqual(['AUTHOR', 'BOOK']);
  });

  it('ternary leaves the 1 end out of the key', () => {
    const schema = mapModel(
      new Diagram()
        .entity('STUDENT')
        .key('student_id', 'STUDENT')
        .entity('COURSE')
        .key('code', 'COURSE')
        .entity('SEMESTER')
        .key('term', 'SEMESTER')
        .relationship('takes', [
          ['STUDENT', { cardinality: 'M' }],
          ['COURSE', { cardinality: 'N' }],
          ['SEMESTER', { cardinality: '1' }],
        ]).model,
    );
    const takes = table(schema, 'takes');
    expect(takes.primaryKey).toEqual(['student_id', 'code']);
    expect(column(takes, 'term').notNull).toBe(true);
    expect(takes.uniques).toEqual([]);
  });

  it('ternary with two 1 ends keys on one and makes the other UNIQUE', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a', 'A')
        .entity('B')
        .key('b', 'B')
        .entity('C')
        .key('c', 'C')
        .relationship('abc', [
          ['A', { cardinality: '1' }],
          ['B', { cardinality: '1' }],
          ['C', { cardinality: 'N' }],
        ]).model,
    );
    const abc = table(schema, 'abc');
    expect(abc.primaryKey).toEqual(['b', 'c']);
    expect(abc.uniques).toEqual([['a', 'c']]);
  });

  it('on the same entity use the roles for the two keys', () => {
    const schema = mapModel(
      new Diagram()
        .entity('PERSON')
        .key('id', 'PERSON')
        .relationship('knows', [
          ['PERSON', { role: 'knower' }],
          ['PERSON', { role: 'known' }],
        ]).model,
    );
    expect(columnNames(table(schema, 'knows'))).toEqual(['knower_id', 'known_id']);
  });

  it('treats a missing cardinality as many, and says so', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship('r', [
          ['A', { cardinality: null }],
          ['B', { cardinality: '1' }],
        ])
        .relationship('s', [
          ['A', { cardinality: null }],
          ['B', { cardinality: 'N' }],
        ]).model,
    );
    expect(columnNames(table(schema, 'A'))).toEqual(['a_id', 'b_id']);
    expect(table(schema, 's').primaryKey).toEqual(['a_id', 'b_id']);
    expect(schema.notes).toEqual([
      text.missingCardinality('r', 'A'),
      text.missingCardinality('s', 'A'),
    ]);
  });

  it('names an unnamed relationship after its table in its notes', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship(
          'r',
          [
            ['A', { cardinality: null }],
            ['B', {}],
          ],
          'regular',
          '',
        )
        .relationship(
          's',
          [
            ['A', { cardinality: null }],
            ['B', { cardinality: '1' }],
          ],
          'regular',
          '',
        ).model,
    );
    expect(schema.notes).toEqual([
      text.unnamedRelationship(text.unnamedTable),
      text.missingCardinality(text.unnamedTable, 'A'),
      text.missingCardinality(text.unnamedRelationshipLabel, 'A'),
    ]);
  });

  it('gets a different name when an entity already has its name', () => {
    const schema = mapModel(
      new Diagram()
        .entity('A')
        .key('a_id', 'A')
        .entity('B')
        .key('b_id', 'B')
        .relationship(
          'r',
          [
            ['A', {}],
            ['B', {}],
          ],
          'regular',
          'a',
        ).model,
    );
    expect(schema.tables.map((t) => t.name)).toEqual(['A', 'B', 'a_2']);
  });
});

describe('foreign keys the student marked', () => {
  function withDepartment(): Diagram {
    return new Diagram()
      .entity('DEPARTMENT')
      .key('dept_id', 'DEPARTMENT', { type: 'INT' })
      .entity('STUDENT')
      .key('student_id', 'STUDENT');
  }

  it('reference the entity they name, taking its key type', () => {
    const schema = mapModel(
      withDepartment().attribute('student_dept', 'STUDENT', {
        name: 'dept_id',
        foreignKey: true,
        column: { references: 'DEPARTMENT' },
      }).model,
    );
    const student = table(schema, 'STUDENT');
    expect(student.foreignKeys).toEqual([
      {
        columns: ['dept_id'],
        table: 'DEPARTMENT',
        referencedColumns: ['dept_id'],
        onDeleteCascade: false,
      },
    ]);
    expect(column(student, 'dept_id').spec.type).toBe('INT');
    expect(schema.notes).toEqual([]);
  });

  it('say so when the type they had did not match', () => {
    const schema = mapModel(
      withDepartment().attribute('dept', 'STUDENT', {
        foreignKey: true,
        column: { type: 'VARCHAR', length: 10, references: 'DEPARTMENT', notNull: true },
      }).model,
    );
    const dept = column(table(schema, 'STUDENT'), 'dept');
    expect(dept.spec.type).toBe('INT');
    expect(dept.notNull).toBe(true);
    expect(schema.notes).toEqual([text.foreignKeyTypeMatched('STUDENT.dept', 'DEPARTMENT')]);
  });

  it('keep a matching type without a note, whatever stale fields it has', () => {
    const schema = mapModel(
      new Diagram()
        .entity('P')
        .key('code', 'P', { type: 'DECIMAL', precision: 5, scale: 1 })
        .entity('Q')
        .key('id', 'Q')
        .attribute('p', 'Q', {
          foreignKey: true,
          column: { type: 'DECIMAL', precision: 5, scale: 1, length: 99, references: 'P' },
        })
        .attribute('r', 'Q', {
          foreignKey: true,
          column: { type: 'DECIMAL', precision: 6, scale: 1, references: 'P' },
        }).model,
    );
    expect(schema.notes).toEqual([text.foreignKeyTypeMatched('Q.r', 'P')]);
  });

  it('say so when they do not name an entity', () => {
    const schema = mapModel(withDepartment().attribute('x', 'STUDENT', { foreignKey: true }).model);
    expect(table(schema, 'STUDENT').foreignKeys).toEqual([]);
    expect(schema.notes).toEqual([text.foreignKeyWithoutTarget('STUDENT.x')]);
  });

  it('get no constraint when the target key has several columns', () => {
    const schema = mapModel(
      new Diagram()
        .entity('FLIGHT')
        .key('airline', 'FLIGHT')
        .key('number', 'FLIGHT')
        .entity('TICKET')
        .key('id', 'TICKET')
        .attribute('flight', 'TICKET', { foreignKey: true, column: { references: 'FLIGHT' } })
        .model,
    );
    expect(table(schema, 'TICKET').foreignKeys).toEqual([]);
    expect(schema.notes).toEqual([text.foreignKeyToCompositeKey('TICKET.flight', 'FLIGHT')]);
  });

  it('are reused by a relationship to the same entity, instead of a second column', () => {
    const schema = mapModel(
      withDepartment()
        .attribute('student_dept', 'STUDENT', {
          name: 'dept_id',
          foreignKey: true,
          column: { references: 'DEPARTMENT' },
        })
        .relationship('majors_in', [
          ['DEPARTMENT', { cardinality: '1' }],
          ['STUDENT', { cardinality: 'N', participation: 'total' }],
        ]).model,
    );
    const student = table(schema, 'STUDENT');
    expect(columnNames(student)).toEqual(['student_id', 'dept_id']);
    expect(student.foreignKeys).toHaveLength(1);
    expect(column(student, 'dept_id').notNull).toBe(true);
  });

  it('are not reused for a relationship to a composite key', () => {
    const schema = mapModel(
      new Diagram()
        .entity('FLIGHT')
        .key('airline', 'FLIGHT')
        .key('number', 'FLIGHT')
        .entity('TICKET')
        .key('id', 'TICKET')
        .attribute('flight', 'TICKET', { foreignKey: true, column: { references: 'FLIGHT' } })
        .relationship('for', [
          ['FLIGHT', { cardinality: '1' }],
          ['TICKET', {}],
        ]).model,
    );
    expect(columnNames(table(schema, 'TICKET'))).toEqual(['id', 'flight', 'airline', 'number']);
  });

  it('may reference their own table', () => {
    const schema = mapModel(
      new Diagram()
        .entity('EMPLOYEE')
        .key('emp_id', 'EMPLOYEE')
        .attribute('manager_id', 'EMPLOYEE', {
          foreignKey: true,
          column: { references: 'EMPLOYEE' },
        }).model,
    );
    expect(table(schema, 'EMPLOYEE').foreignKeys[0]).toMatchObject({
      columns: ['manager_id'],
      table: 'EMPLOYEE',
    });
  });
});

describe('damaged models', () => {
  it('refuses a relationship to an entity that is not there, which import already rejects', () => {
    const model = new Diagram()
      .entity('A')
      .key('a', 'A')
      .entity('B')
      .key('b', 'B')
      .relationship('r', [
        ['A', {}],
        ['B', {}],
      ]).model;
    const damaged = { ...model, entities: model.entities.slice(0, 1) };
    expect(() => mapModel(damaged)).toThrow('No table for entity "B"');
  });

  it('maps an empty model to no tables', () => {
    expect(mapModel(new Diagram().model)).toEqual({ tables: [], notes: [] });
  });
});
