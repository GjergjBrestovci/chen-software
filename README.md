# ChenLab

A browser app for drawing Entity-Relationship diagrams in **Chen notation**,
made for students who would otherwise sketch them on paper.

**Try it:** https://gjergjbrestovci.github.io/chen-software/

Everything runs in the browser. There is no backend and no account; your
diagram is autosaved locally.

## Features

- Entities (regular and weak), relationships (regular and identifying) and
  attributes (simple, composite, multivalued, derived)
- Keys and partial keys, cardinalities (`1`, `N`, `M`) and total or partial
  participation
- Drag, pan, zoom, snap to grid, multi-select, undo and redo
- Light and dark theme, with a colour per component
- Save and open diagrams as `.erd.json` files
- Export as a vector PDF, or as MySQL `CREATE TABLE` statements

## Keyboard shortcuts

| Key                       | Action                                          |
| ------------------------- | ----------------------------------------------- |
| `E`                       | Add an entity                                   |
| `A`                       | Add an attribute to the selection               |
| `R`                       | Toggle relationship mode                        |
| `Delete`                  | Delete the selection                            |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo                                     |
| `Ctrl+S`                  | Save                                            |
| `Esc`                     | Leave relationship mode, or clear the selection |

## Development

Requires Node.js 22.

```sh
npm install
npm run dev
```

| Script               | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Start the dev server                                          |
| `npm run build`      | Typecheck and build into `dist/`                              |
| `npm test`           | Run the tests                                                 |
| `npm run coverage`   | Run the tests and enforce the coverage thresholds             |
| `npm run lint`       | Lint with ESLint                                              |
| `npm run format`     | Format with Prettier                                          |
| `npm run verify:sql` | Check the SQL fixtures against MySQL (needs Docker or Podman) |

Built with React, TypeScript, Vite and React Flow.

## Contributing

Open a pull request against `main`. It needs a passing CI run (lint,
formatting, typecheck, tests with coverage, build) and the owner's approval
before it can be merged. Every commit on `main` is checked the same way and
then deployed to GitHub Pages.
