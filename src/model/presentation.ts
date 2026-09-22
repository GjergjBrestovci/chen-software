import type { Color, ComponentTheme, ElementKind, Id, Presentation } from './types';

/**
 * Colour handling (SPEC.md §6).
 *
 * A component is drawn in its own override if it has one, otherwise in the
 * theme colour for its kind. The default theme is the neutral ink the app has
 * always used, so a new diagram looks exactly as it did before colour existed.
 */

export const DEFAULT_THEME: ComponentTheme = {
  entity: '#333333',
  relationship: '#333333',
  attribute: '#333333',
};

export function createPresentation(theme: ComponentTheme = DEFAULT_THEME): Presentation {
  return { theme: { ...theme }, colors: {} };
}

/** The colour a component is drawn in. */
export function colorFor(presentation: Presentation, id: Id, kind: ElementKind): Color {
  return presentation.colors[id] ?? presentation.theme[kind];
}

/** True when the component uses its own colour rather than the theme's. */
export function hasColorOverride(presentation: Presentation, id: Id): boolean {
  return Object.hasOwn(presentation.colors, id);
}
