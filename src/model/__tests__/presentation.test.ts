import { describe, expect, it } from 'vitest';
import {
  COLOR_PALETTE,
  colorFor,
  createPresentation,
  DEFAULT_THEME,
  FILL_OPACITY,
  fillFor,
  hasColorOverride,
} from '../presentation';

describe('DEFAULT_THEME', () => {
  it('chooses no colour, so components follow the interface ink', () => {
    expect(DEFAULT_THEME).toEqual({ entity: null, relationship: null, attribute: null });
  });

  it('starts a presentation with no overrides', () => {
    expect(createPresentation()).toEqual({ theme: DEFAULT_THEME, colors: {} });
  });

  it('copies the theme rather than aliasing it', () => {
    const theme = { entity: '#2563eb', relationship: null, attribute: null };
    const presentation = createPresentation(theme);
    theme.entity = '#dc2626';
    expect(presentation.theme.entity).toBe('#2563eb');
  });
});

describe('colorFor', () => {
  it('falls back to null when neither theme nor override has a colour', () => {
    expect(colorFor(createPresentation(), 'a', 'entity')).toBeNull();
  });

  it('uses the theme colour for the component kind', () => {
    const presentation = createPresentation({
      entity: '#2563eb',
      relationship: '#16a34a',
      attribute: '#d97706',
    });
    expect(colorFor(presentation, 'a', 'entity')).toBe('#2563eb');
    expect(colorFor(presentation, 'a', 'relationship')).toBe('#16a34a');
    expect(colorFor(presentation, 'a', 'attribute')).toBe('#d97706');
  });

  it('prefers an override over the theme', () => {
    const presentation = { ...createPresentation({ ...DEFAULT_THEME, entity: '#2563eb' }) };
    presentation.colors = { a: '#dc2626' };
    expect(colorFor(presentation, 'a', 'entity')).toBe('#dc2626');
    expect(colorFor(presentation, 'b', 'entity')).toBe('#2563eb');
  });
});

describe('hasColorOverride', () => {
  it('distinguishes an override from a theme colour', () => {
    const presentation = createPresentation({ ...DEFAULT_THEME, entity: '#2563eb' });
    expect(hasColorOverride(presentation, 'a')).toBe(false);
    presentation.colors = { a: '#dc2626' };
    expect(hasColorOverride(presentation, 'a')).toBe(true);
  });
});

describe('fillFor', () => {
  it('turns a hex colour into a translucent fill', () => {
    expect(fillFor('#2563eb')).toBe(`rgba(37, 99, 235, ${String(FILL_OPACITY)})`);
  });

  it('handles the extremes', () => {
    expect(fillFor('#000000')).toContain('0, 0, 0');
    expect(fillFor('#ffffff')).toContain('255, 255, 255');
  });

  it('accepts uppercase hex, which the schema also allows', () => {
    expect(fillFor('#FF8800')).toBe(fillFor('#ff8800'));
  });

  it('stays well below full strength, so overlapping shapes remain legible', () => {
    expect(FILL_OPACITY).toBeGreaterThan(0);
    expect(FILL_OPACITY).toBeLessThan(0.3);
  });
});

describe('COLOR_PALETTE', () => {
  it('offers distinct, well-formed swatches', () => {
    expect(COLOR_PALETTE.length).toBeGreaterThanOrEqual(6);
    expect(new Set(COLOR_PALETTE).size).toBe(COLOR_PALETTE.length);
    for (const color of COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
