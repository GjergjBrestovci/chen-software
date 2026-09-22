import type { CSSProperties } from 'react';
import { fillFor } from '../../model/presentation';
import type { ComponentColor } from '../scene';

/**
 * Turns a component's colour into CSS custom properties.
 *
 * Outline and text take the colour at full strength, the fill takes it at 12%
 * (SPEC.md §6). A component with no colour falls back to the interface ink,
 * which is what makes the dark theme work for an uncoloured diagram.
 */
export function componentStyle(color: ComponentColor): CSSProperties {
  if (color === null) {
    return {};
  }
  return {
    '--chen-component-stroke': color,
    '--chen-component-fill': fillFor(color),
  } as CSSProperties;
}
