import type { Color, ComponentTheme, ElementKind, Id, Presentation } from './types';

/**
 * Colour handling (SPEC.md §6).
 *
 * A component is drawn in its own override if it has one, otherwise in the
 * theme colour for its kind. Both can be absent: `null` means "no colour
 * chosen", and the canvas falls back to the interface ink, which follows the
 * light/dark theme. That fallback has to be a real state rather than a literal
 * dark hex, or every default diagram would be invisible in dark mode.
 */

/** No colour chosen for any kind: everything follows the interface ink. */
export const DEFAULT_THEME: ComponentTheme = {
  entity: null,
  relationship: null,
  attribute: null,
};

/**
 * Swatches offered in the colour menu. Chosen to stay legible as an outline on
 * both a white and a near-black canvas.
 */
export const COLOR_PALETTE: readonly Color[] = [
  '#64748b',
  '#dc2626',
  '#d97706',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
];

/** Fill strength behind a coloured component (SPEC.md §6). */
export const FILL_OPACITY = 0.12;

export function createPresentation(theme: ComponentTheme = DEFAULT_THEME): Presentation {
  return { theme: { ...theme }, colors: {} };
}

/**
 * The colour a component is drawn in, or `null` when it has none and should
 * follow the interface ink.
 */
export function colorFor(presentation: Presentation, id: Id, kind: ElementKind): Color | null {
  return presentation.colors[id] ?? presentation.theme[kind];
}

/** True when the component uses its own colour rather than the theme's. */
export function hasColorOverride(presentation: Presentation, id: Id): boolean {
  return Object.hasOwn(presentation.colors, id);
}

/**
 * The translucent fill behind a coloured component.
 *
 * Computed here rather than with a CSS `color-mix`, so the PDF exporter and the
 * canvas produce the same value from the same function, the way text metrics
 * are shared (SPEC.md §8).
 */
export function fillFor(color: Color): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${FILL_OPACITY})`;
}
