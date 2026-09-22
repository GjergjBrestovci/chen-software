# ChenLab — Educational ER Modeling Tool (Chen Notation)

## 1. Purpose

A browser app where students draw Entity-Relationship diagrams in **Chen notation** and export them as vector PDFs.

The app is **educational**. It must help students _understand_ data modeling, never do the modeling for them.

### Hard product rules (non-negotiable)

1. **No auto-fix, no auto-generation.** The app never creates, renames, deletes or changes model elements on its own. There is no "fix it" button.
2. **Feedback is phrased as questions**, not solutions. Example: "Which attribute uniquely identifies a BOOK?" is correct. "Mark ISBN as key" is forbidden.
3. **Correctness depends only on the semantic model**, never on layout. Moving shapes never changes validation results.
4. **Intuitive first.** A student who has never seen the app must be able to create an entity, attributes, a relationship and cardinalities within 2 minutes without reading docs.

## 2. Scope

### MVP (this build)

- Entities (rectangle)
- Attributes (ellipse): `simple`, `key` (name underlined)
- Binary relationships (diamond) with cardinality labels `1`, `N`, `M` on each end
- Attributes on relationships (non-key only)
- Drag, pan, zoom, snap-to-grid, multi-select, delete
- Undo/redo
- Read-back sentences for cardinalities (see §6)
- Validator with 3-level question hints (see §7)
- Autosave (IndexedDB), import/export `.erd.json`
- Vector PDF export

### Later phases (do NOT build now, but don't block them architecturally)

- Phase 2: weak entities (double rectangle), identifying relationships (double diamond), partial keys (dashed underline), multivalued (double ellipse), derived (dashed ellipse), composite attributes, total participation (double line), self-relationships with role names, ternary relationships
- Phase 3: Relational view. The student writes tables, PKs and FKs manually, and a checker compares them against the ER model.
- i18n (German). All user-facing strings must therefore live in one messages module from day one.

## 3. Tech stack

- Vite + React 18 + TypeScript (`strict: true`, no `any`)
- `@xyflow/react` (v12) for the canvas
- `zustand` + `immer` for state, `zundo` for undo/redo
- `zod` for file schema validation
- `idb-keyval` for autosave
- `svg2pdf.js` + `jspdf` for PDF export
- `vitest` + `@testing-library/react` for tests
- ESLint + Prettier
- Fully client-side. No backend, no accounts.

## 4. Architecture

### Strict separation

```
model (semantics)  ──►  validator, read-back, (later) relational checker
layout (positions) ──►  canvas rendering, SVG/PDF export
```

Validator and read-back functions take `ErModel` only. They are pure and must have no React imports.

### Folder structure

```
src/
  model/        types.ts, schema.ts (zod), operations.ts (pure model mutations), ids.ts
  layout/       types.ts, placement.ts (free-spot finding for new attributes)
  geometry/     boundary intersection for rect/diamond/ellipse, label positioning
  validation/   rules/*.ts (one rule per file), runValidation.ts, types.ts
  readback/     sentences.ts
  export/       renderSvg.ts (pure: model+layout -> SVG string), exportPdf.ts
  persistence/  autosave.ts, fileIO.ts, migrations.ts
  store/        documentStore.ts (zustand + zundo)
  canvas/       nodes/ (EntityNode, RelationshipNode, AttributeNode), edges/ (ChenEdge), Canvas.tsx
  ui/           Toolbar, Inspector, HintPanel, ReadbackPanel
  i18n/         messages.en.ts
```

### Data model

```ts
type Id = string; // nanoid
type Cardinality = '1' | 'N' | 'M';
type OwnerKind = 'entity' | 'relationship';

interface Entity {
  id: Id;
  name: string;
}

interface Attribute {
  id: Id;
  ownerId: Id; // entity or relationship
  ownerKind: OwnerKind;
  name: string;
  kind: 'simple' | 'key'; // extended in phase 2
}

interface RelationshipEnd {
  entityId: Id;
  cardinality: Cardinality | null; // null = not yet set by student
}

interface Relationship {
  id: Id;
  name: string;
  ends: [RelationshipEnd, RelationshipEnd]; // widened to RelationshipEnd[] in phase 2
}

interface ErModel {
  entities: Entity[];
  attributes: Attribute[];
  relationships: Relationship[];
}

interface Layout {
  // entities/relationships: absolute; attributes: offset relative to owner
  positions: Record<Id, { x: number; y: number }>;
}

interface ErDocument {
  version: 1;
  title: string;
  model: ErModel;
  layout: Layout;
  dismissedHints: string[]; // `${ruleId}:${targetId}`
}
```

Deleting an entity cascades to its attributes and to every relationship touching it, including that relationship's attributes. This must be one undoable operation.

## 5. Canvas & interaction

### Rendering (Chen notation)

- Entity: rectangle, name centered.
- Relationship: diamond, name centered.
- Attribute: ellipse, name centered. `key` means the name is underlined.
- Lines are plain, with no arrowheads, and connect **shape boundaries**, not centers. Use floating edges: compute the intersection of the center-to-center line with each shape's outline (rect, diamond, ellipse) in `geometry/`.
- **Cardinality label** is drawn next to the **entity it counts**, placed ~20 px from the entity boundary along the edge and offset perpendicular so it doesn't overlap the line.
  - `PUBLISHER ─1─<published_by>─N─ BOOK` means one publisher, many books. The `N` is stored on the BOOK end and drawn beside BOOK.
  - An unset cardinality renders as a small dashed placeholder `?` that is clickable.
- Background grid like graph paper, with snap-to-grid (toggleable).
- Shapes auto-size to their text, with a minimum size.

### Attachment

Attributes move with their owner. Implement with React Flow `parentId` (attribute node's parent = owner node, no `extent` restriction) so dragging the owner moves its attributes. Attributes are still individually draggable.

### Creating things

- Toolbar and shortcuts:
  - `E` = new entity at viewport center (or at the double-click position on empty canvas)
  - `A` = add attribute to the selected entity/relationship, placed at a free spot around the owner (`layout/placement.ts`)
  - `R` = relationship mode: click entity A, then entity B, and a diamond is created at the midpoint with both cardinalities `null`
- Dragging from an entity's connection handle onto another entity also creates a relationship.
- A new element immediately enters inline rename mode. Enter confirms, Esc cancels. An empty name is allowed but flagged by the validator.
- Double-click any shape to rename it.
- Click a cardinality label to cycle `? → 1 → N → M → 1`. Also editable in the Inspector.
- `Delete`/`Backspace` removes the selection. `Ctrl/Cmd+Z` undoes, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redoes.
- `Ctrl/Cmd+S` exports `.erd.json`. The browser default is prevented.

### Inspector (right panel)

Shows the selected element:

- Name
- For attributes: kind toggle (simple/key). Hidden for relationship attributes.
- For relationships: cardinality selects for each end, plus the read-back sentences.

### Undo/redo

One history entry per user action. A drag records **one** entry on drag stop, not per mouse move. Renaming records on confirm.

## 6. Read-back sentences

When a relationship's cardinalities are set, show two plain-language sentences in the Inspector and in a tooltip on hover. They only restate the student's choice and never judge it.

For relationship `R` with ends `(A, cA)` and `(B, cB)`:

- "Each **{A}** is related via _{R}_ to **{cB === '1' ? 'exactly one' : 'many'}** {B}."
- "Each **{B}** is related via _{R}_ to **{cA === '1' ? 'exactly one' : 'many'}** {A}."

Example: AUTHOR(1) ─ writes ─ BOOK(N) gives

- "Each AUTHOR is related via _writes_ to many BOOK."
- "Each BOOK is related via _writes_ to exactly one AUTHOR."

The student reads the second sentence and realizes co-authored books exist. That realization is the learning moment.

If a cardinality is `null`, the sentence shows `___` in place of the count.

## 7. Validator

### Types

```ts
interface Hint {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  targetIds: Id[]; // elements to highlight
  levels: [string, string, string]; // increasingly specific QUESTIONS, never the answer
}
type Rule = (m: ErModel) => Hint[];
```

- Validation runs on every model change (debounced ~200 ms).
- Targets get a subtle colored outline on the canvas (red = error, amber = warning, blue = info).
- The Hint panel lists hints. Each shows level 1 first, and a "More help" button reveals levels 2, then 3. There is no level 4.
- Warnings and info can be dismissed per target, and dismissals are stored in the document. Errors cannot be dismissed.

### MVP rules

| id                         | severity | condition                                                             | level 1 → 3 (example wording)                                                                                                                         |
| -------------------------- | -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unnamed-element`          | error    | empty/whitespace name                                                 | "Something in your diagram has no name." → "This {kind} has no name." → "What real-world thing does this {kind} represent?"                           |
| `entity-no-key`            | error    | entity has no `key` attribute                                         | "An entity might be missing something important." → "{E} has no key attribute." → "Which attribute(s) uniquely identify one {E}?"                     |
| `missing-cardinality`      | error    | any end `null`                                                        | "A relationship is incomplete." → "{R} is missing a cardinality." → "How many {B} can one {A} be related to via {R}?"                                 |
| `key-on-relationship`      | error    | relationship attribute with kind `key` (guard against imported files) | "A relationship attribute is marked in an unusual way." → "{attr} on {R} is marked as key." → "Can a relationship have its own key in Chen notation?" |
| `duplicate-entity-name`    | error    | two entities share a name (case-insensitive, trimmed)                 | "Two things share a name." → "There are two entities called {E}." → "Are these really the same concept? If so, why two boxes?"                        |
| `duplicate-attribute-name` | warning  | same owner has two attributes with the same name                      | …                                                                                                                                                     |
| `isolated-entity`          | info     | entity in no relationship, and the model has ≥2 entities              | "One entity stands alone." → "{E} is not part of any relationship." → "How is {E} connected to the rest of your domain?"                              |
| `one-to-one`               | info     | both ends `1`                                                         | "Double-check one relationship." → "{R} is one-to-one." → "Read the two sentences for {R} out loud — are both really true?"                           |
| `nn-style`                 | info     | both ends many with the same letter (`N:N` or `M:M`)                  | "A notation detail." → "{R} uses the same letter on both sides." → "Many-to-many is usually written M:N. Which does your class use?"                  |

Each rule lives in its own file with its own unit tests (positive and negative cases).

**Wording review:** every message must pass "does this reveal the answer?" If it does, rewrite it as a question.

## 8. Export

### Vector PDF

- `renderSvg(model, layout, options): string` is pure and reuses the `geometry/` functions. Do **not** screenshot the DOM.
- `exportPdf` converts that SVG with svg2pdf.js + jsPDF.
- Options:
  - page size A4/Letter
  - orientation auto (landscape if the diagram is wider than tall) or manual
  - "clean mode" hides validator highlights and is on by default
  - an optional title header with the document title and a free-text student name field
- The diagram is scaled to fit the page with margins. Font is Helvetica, since it's built into jsPDF.

### JSON

`.erd.json` holds the full `ErDocument`. On import:

- validate with zod
- run `migrations.ts` by `version`
- reject malformed files with a clear message
- never partially load a malformed file

## 9. Persistence

- Autosave the current document to IndexedDB, debounced ~500 ms, and restore it on load.
- "New diagram" asks for confirmation if there are unsaved changes, meaning changes since the last export.

## 10. Quality bar

- Clean, production-level code: small focused modules, no dead code, no commented-out code.
- Pure logic (model ops, geometry, validation, read-back, renderSvg, migrations) has **≥90% unit-test coverage**.
- No `any`, no non-null assertions without a comment explaining why.
- All user-facing strings live in `i18n/messages.en.ts`.
- Accessibility: all toolbar buttons have labels and tooltips showing shortcuts, focus states are visible, and colors are not the only indicator (outlines plus an icon in the hint panel).
- Performance: smooth dragging with 30 entities and 150 attributes.

## 11. Milestones & acceptance criteria

1. **Scaffold:** Vite/TS/ESLint/Prettier/Vitest set up. Model types, zod schema, and model operations with tests.
2. **Geometry:** boundary intersections for rect/diamond/ellipse and cardinality label placement, with tests.
3. **Canvas:** entities, attributes (attached via parentId), relationships, floating Chen edges, cardinality labels, grid/snap, pan/zoom, all creation/rename/delete interactions from §5.
   - _Accept:_ the diagram from the reference photo (BOOK, AUTHOR, PUBLISHER, GENRE + attributes) can be recreated in under 5 minutes.
4. **Undo/redo:** one entry per action, drag coalesced.
5. **Read-back + Inspector.**
6. **Validator + Hint panel:** all MVP rules, 3 levels, dismissals.
7. **Persistence:** autosave, import/export, migrations scaffold.
8. **PDF export:** vector, fits the page, clean mode.
   - _Accept:_ the PDF text is selectable and lines stay sharp at 400% zoom.

## 12. Test fixture

Include `fixtures/bookstore.erd.json`, the corrected version of the reference diagram:

- PUBLISHER(name KEY) 1 ─ published_by ─ N BOOK
- AUTHOR(author_id KEY, name) M ─ writes ─ N BOOK
- GENRE(type KEY, age_rating) 1 ─ belongs_to ─ N BOOK
- BOOK(isbn KEY, title, pages, price, publication_date, language)

It must produce **zero** error/warning hints. Also include `fixtures/bookstore-broken.erd.json`: no cardinalities, unnamed relationships, and AUTHOR without a key. It must trigger `missing-cardinality`, `unnamed-element`, and `entity-no-key`.
