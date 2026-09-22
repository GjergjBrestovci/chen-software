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
    save: 'Save',
    saveShortcut: 'Ctrl+S',
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

  dialog: {
    cancel: 'Cancel',
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
    keysAreEntityOnly: 'Only an entity attribute can be a key.',
    compositeHasParts: 'Delete its parts before changing the shape.',
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
