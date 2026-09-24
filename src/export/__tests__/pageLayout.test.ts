import { describe, expect, it } from 'vitest';
import { layoutPage, MAX_SCALE, PAGE_MARGIN, PAGE_SIZES } from '../pageLayout';
import type { PageLayout, PageLayoutInput } from '../pageLayout';

function layout(overrides: Partial<PageLayoutInput> = {}): PageLayout {
  return layoutPage({
    content: { width: 1800, height: 1200 },
    pageSize: 'a4',
    orientation: 'auto',
    headerHeight: 0,
    ...overrides,
  });
}

/** True when the diagram sits entirely inside the page's margins and below the header. */
function fitsInside(result: PageLayout, headerHeight = 0): boolean {
  const { diagram, page } = result;
  const epsilon = 1e-6;
  return (
    diagram.x >= PAGE_MARGIN - epsilon &&
    diagram.y >= PAGE_MARGIN + headerHeight - epsilon &&
    diagram.x + diagram.width <= page.width - PAGE_MARGIN + epsilon &&
    diagram.y + diagram.height <= page.height - PAGE_MARGIN + epsilon
  );
}

describe('layoutPage', () => {
  it('turns the page sideways for a diagram wider than it is tall', () => {
    const result = layout({ content: { width: 1800, height: 1200 } });
    expect(result.orientation).toBe('landscape');
    expect(result.page.width).toBeGreaterThan(result.page.height);
  });

  it('keeps the page upright for a diagram taller than it is wide', () => {
    const result = layout({ content: { width: 600, height: 1400 } });
    expect(result.orientation).toBe('portrait');
    expect(result.page).toEqual(PAGE_SIZES.a4);
  });

  it('honours an orientation chosen by hand', () => {
    expect(layout({ orientation: 'portrait' }).orientation).toBe('portrait');
    expect(
      layout({ orientation: 'landscape', content: { width: 100, height: 900 } }).orientation,
    ).toBe('landscape');
  });

  it('fits a large diagram inside the margins', () => {
    for (const pageSize of ['a4', 'letter'] as const) {
      for (const orientation of ['auto', 'portrait', 'landscape'] as const) {
        expect(fitsInside(layout({ pageSize, orientation }))).toBe(true);
      }
    }
  });

  it('keeps the diagram in proportion', () => {
    const result = layout({ content: { width: 1800, height: 1200 } });
    expect(result.diagram.width / result.diagram.height).toBeCloseTo(1800 / 1200, 9);
  });

  it('never blows a small diagram up past full size', () => {
    const result = layout({ content: { width: 200, height: 100 } });
    expect(result.scale).toBe(MAX_SCALE);
    expect(result.diagram.width).toBe(200);
  });

  it('centres the diagram across the page', () => {
    const result = layout({ content: { width: 200, height: 100 } });
    const left = result.diagram.x;
    const right = result.page.width - result.diagram.x - result.diagram.width;
    expect(left).toBeCloseTo(right, 9);
  });

  it('keeps clear of the header and shrinks to make room for it', () => {
    const without = layout({ content: { width: 600, height: 1400 } });
    const withHeader = layout({ content: { width: 600, height: 1400 }, headerHeight: 60 });
    expect(withHeader.diagram.y).toBe(without.diagram.y + 60);
    expect(withHeader.scale).toBeLessThan(without.scale);
    expect(fitsInside(withHeader, 60)).toBe(true);
  });

  it('uses the Letter page size when asked', () => {
    const result = layout({ pageSize: 'letter', orientation: 'portrait' });
    expect(result.page).toEqual(PAGE_SIZES.letter);
  });

  it('honours a custom margin', () => {
    const result = layout({ content: { width: 200, height: 100 }, margin: 10 });
    expect(result.diagram.y).toBe(10);
  });

  it('copes with an empty diagram without dividing by zero', () => {
    const result = layout({ content: { width: 0, height: 0 } });
    expect(result.scale).toBe(MAX_SCALE);
    expect(result.diagram.width).toBe(0);
    expect(Number.isFinite(result.diagram.x)).toBe(true);
  });

  it('never reports a negative space when the margin exceeds the page', () => {
    const result = layout({ margin: 1000 });
    expect(result.diagram.width).toBe(0);
    expect(result.diagram.height).toBe(0);
  });
});
