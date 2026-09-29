/**
 * Every user-facing string in ChenLab lives here (SPEC.md §10), so that the
 * German translation planned in §2 is a matter of adding one sibling module.
 *
 * Developer-facing text (the `ModelError` messages in `model/errors.ts`) is
 * deliberately NOT here: those signal programmer mistakes, never reach a
 * student, and must not be translated.
 */
export const messages = {
  app: {
    title: 'ChenLab',
    tagline: 'Draw Entity-Relationship diagrams in Chen notation.',
  },

  document: {
    untitled: 'Untitled diagram',
  },

  /** Opening and saving `.erd.json` files (SPEC.md §8, §9). */
  file: {
    newDiagram: 'New diagram',
    open: 'Open',
    save: 'Save project',
    saveShortcut: 'Ctrl+S',
    title: 'Diagram title',
    discardChanges:
      'This diagram has changes you have not saved to a file. Start a new one anyway?',
    discardConfirm: 'Discard and start new',
    opened: (title: string): string => `Opened ${title}.`,
    notJson: 'This file could not be read as JSON. Is it really an .erd.json diagram?',
    invalid: 'This file is not a valid ChenLab diagram, so nothing was loaded.',
    unsupportedVersion: (version: number): string =>
      `This diagram was saved in format version ${String(version)}, which this version of ChenLab cannot open.`,
    duplicateId: (id: string): string =>
      `This diagram uses the id "${id}" for more than one element, so nothing was loaded.`,
    unknownAttributeOwner: (attribute: string): string =>
      `The attribute ${attribute} belongs to an element that is missing from the file, so nothing was loaded.`,
    attributeOwnerKindMismatch: (attribute: string): string =>
      `The attribute ${attribute} does not match the kind of element it is attached to, so nothing was loaded.`,
    unknownRelationshipEntity: (relationship: string): string =>
      `The relationship ${relationship} connects to an entity that is missing from the file, so nothing was loaded.`,
    unknownColumnReference: (attribute: string): string =>
      `The foreign key ${attribute} references an entity that is missing from the file, so nothing was loaded.`,
    attributeOwnerCycle: (attribute: string): string =>
      `The attribute ${attribute} is part of itself, which cannot be drawn, so nothing was loaded.`,
    placedMissingPositions: (count: number): string =>
      count === 1
        ? 'One element had no saved position and was placed on the canvas for you.'
        : `${String(count)} elements had no saved position and were placed on the canvas for you.`,
  },

  /** Fallback label for an element the student has not named yet. */
  element: {
    unnamed: 'an unnamed element',
  },

  canvas: {
    label: 'Diagram canvas',
    cardinalityPlaceholder: '?',
    cardinalityHint: 'Click to change: 1, N, M',
    cardinalityUnsetLabel: 'Cardinality not set yet. Click to choose.',
    cardinalitySetLabel: (value: string): string => `Cardinality ${value}. Click to change.`,
    selfRelationshipRejected: 'A relationship needs two different entities.',
    relationshipNeedsEntities: 'Relationships connect two entities. Pick an entity.',
    pickFirstEntity: 'Pick the first entity.',
    pickSecondEntity: 'Now pick the second entity.',
    attributeNeedsOwner: 'Select one entity or relationship first, then press A.',
  },

  pdf: {
    export: 'Export PDF',
    exporting: 'Exporting…',
    dialogTitle: 'Export PDF',
    pageSize: 'Page size',
    a4: 'A4',
    letter: 'Letter',
    orientation: 'Orientation',
    auto: 'Automatic',
    portrait: 'Portrait',
    landscape: 'Landscape',
    includeHeader: 'Title at the top',
    studentName: 'Your name',
    studentNamePlaceholder: 'Optional',
    standardNotation: 'Standard Chen notation only',
    standardNotationHint:
      'Leaves out the crown and plug markers, which some graders do not accept.',
    failed: 'The PDF could not be created. Please try again.',
  },

  /** The MySQL export: identifiers it has to invent, and the notes it writes. */
  sql: {
    unnamedTable: 'unnamed_table',
    unnamedRelationshipLabel: 'An unnamed relationship',
    unnamedColumn: 'unnamed_column',
    generatedKey: 'id',
    unnamedEntity: (name: string): string => `An unnamed entity was exported as ${name}.`,
    unnamedRelationship: (name: string): string =>
      `An unnamed relationship was exported as ${name}.`,
    unnamedAttribute: (name: string): string => `An unnamed attribute was exported as ${name}.`,
    duplicateTable: (wanted: string, name: string): string =>
      `Two tables would be called ${wanted}, so one became ${name}.`,
    missingCardinality: (relationship: string, entity: string): string =>
      `${relationship} has no cardinality on the ${entity} end, so it was treated as many.`,
    derivedLeftOut: (attribute: string, table: string): string =>
      `${attribute} in ${table} is derived, so it has no column.`,
    generatedPrimaryKey: (entity: string): string =>
      `${entity} has no key attribute, so a generated id column is its primary key.`,
    weakWithoutOwner: (entity: string): string =>
      `${entity} is a weak entity but no identifying relationship connects it, so its key is only its own.`,
    ownerCycle: (entity: string, owner: string): string =>
      `${entity} and ${owner} identify each other, so ${entity} does not take ${owner}'s key.`,
    foreignKeyWithoutTarget: (column: string): string =>
      `${column} is marked as a foreign key but does not say which entity it references.`,
    foreignKeyToCompositeKey: (column: string, table: string): string =>
      `${column} references ${table}, whose primary key has several columns, so no foreign key constraint was added.`,
    foreignKeyTypeMatched: (column: string, table: string): string =>
      `${column} was given the type of ${table}'s key, because a foreign key must match the column it references.`,
    autoIncrementIgnored: (column: string): string =>
      `${column} asks for AUTO_INCREMENT, which MySQL allows only on a primary key that is one whole-number column, so it was left out.`,
    missingTypes: (columns: string): string =>
      `These columns have no type yet, so they were made VARCHAR(255): ${columns}.`,
    missingLength: (column: string): string =>
      `${column} is VARCHAR with no length, so it was given 255.`,
    lengthClamped: (column: string, limit: number): string =>
      `${column} is longer than MySQL allows, so it was shortened to ${String(limit)}.`,
    decimalClamped: (column: string): string =>
      `${column} has a DECIMAL precision or scale MySQL does not allow, so it was brought into range.`,
    textInKey: (column: string): string =>
      `${column} is TEXT, which MySQL cannot use in a key, so it was made VARCHAR(255).`,
    invalidDefault: (column: string, type: string): string =>
      `The default for ${column} is not a valid ${type} value, so it was left out.`,
    header: (title: string): string => `${title}: MySQL tables exported from ChenLab.`,
    notesHeading: 'Notes:',
  },

  /** The Export SQL dialog. */
  sqlExport: {
    export: 'Export SQL',
    dialogTitle: 'Export SQL (MySQL)',
    dropExisting: 'Start with DROP TABLE IF EXISTS',
    dropExistingHint: 'So the script can be run again on a database that already has these tables.',
    preview: 'SQL',
    notes: 'How the diagram was read',
    copy: 'Copy',
    copied: 'The SQL was copied to the clipboard.',
    copyFailed: 'The SQL could not be copied. Select it and copy it by hand.',
    download: 'Download .sql',
  },

  dialog: {
    cancel: 'Cancel',
    close: 'Close',
    label: 'Confirm',
  },

  menu: {
    label: 'Component options',
    rename: 'Rename',
    delete: 'Delete',
    colour: 'Colour',
    useThemeColour: 'Theme colour',
    swatch: (index: number): string => `Colour ${String(index)}`,
    entityKind: 'Entity',
    regular: 'Regular',
    weak: 'Weak',
    relationshipKind: 'Relationship',
    identifying: 'Identifying',
    attributeShape: 'Shape',
    simple: 'Simple',
    composite: 'Composite',
    multivalued: 'Multivalued',
    derived: 'Derived',
    attributeKey: 'Key',
    noKey: 'None',
    primaryKey: 'Primary key',
    partialKey: 'Partial key',
    relational: 'Relational',
    foreignKey: 'Foreign key',
    columnDetails: 'Column details…',
    keysAreEntityOnly: 'Only an entity attribute can be a key.',
    compositeHasParts: 'Delete its parts before changing the shape.',
  },

  /** The column panel: details only the SQL export uses. */
  column: {
    label: 'Column details',
    title: (attribute: string): string => `Column details for ${attribute}`,
    hint: 'Only Export SQL uses these. Nothing here appears on the diagram or in the PDF.',
    type: 'Type',
    notSet: '— not set —',
    length: 'Length',
    precision: 'Precision',
    scale: 'Scale',
    notNull: 'NOT NULL',
    keyIsNotNull: 'A key is always NOT NULL.',
    unique: 'UNIQUE',
    autoIncrement: 'AUTO_INCREMENT',
    defaultValue: 'Default',
    defaultPlaceholder: 'None',
    references: 'References',
    referencesHint: 'Mark it as a foreign key to choose which entity it references.',
    derived: 'A derived attribute is worked out from others, so it has no column of its own.',
    composite: 'A composite attribute is stored as its parts. Give each part its own details.',
    wholeNumber: (field: string, minimum: number): string =>
      `${field} must be a whole number of at least ${String(minimum)}.`,
    apply: 'Apply',
  },

  marker: {
    primaryKey: 'Primary key',
    foreignKey: 'Foreign key',
  },

  toolbar: {
    addEntity: 'New entity',
    addEntityShortcut: 'E',
    addAttribute: 'Add attribute',
    addAttributeShortcut: 'A',
    relationshipMode: 'Relationship',
    relationshipModeShortcut: 'R',
    deleteSelection: 'Delete selection',
    deleteSelectionShortcut: 'Delete',
    undo: 'Undo',
    undoShortcut: 'Ctrl+Z',
    redo: 'Redo',
    redoShortcut: 'Ctrl+Shift+Z',
    snapToGrid: 'Snap to grid',
    darkTheme: 'Switch between light and dark',
    darkMode: 'Dark',
    lightMode: 'Light',
    shortcutSuffix: (key: string): string => ` (${key})`,
  },

  notice: {
    dismiss: 'Dismiss',
  },
} as const;
