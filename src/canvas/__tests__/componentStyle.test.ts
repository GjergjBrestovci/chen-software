import { describe, expect, it } from 'vitest';
import { componentStyle } from '../nodes/componentStyle';
import { fillFor } from '../../model/presentation';

describe('componentStyle', () => {
  it('sets nothing when the component has no colour of its own', () => {
    // The stylesheet then falls back to the interface ink, which is what makes
    // an uncoloured diagram follow the dark theme.
    expect(componentStyle(null)).toEqual({});
  });

  it('drives the outline at full strength and the fill at 12%', () => {
    expect(componentStyle('#2563eb')).toEqual({
      '--chen-component-stroke': '#2563eb',
      '--chen-component-fill': fillFor('#2563eb'),
    });
  });

  it('uses the same fill computation the exporter will', () => {
    const style = componentStyle('#dc2626') as Record<string, string>;
    expect(style['--chen-component-fill']).toBe(fillFor('#dc2626'));
  });
});
