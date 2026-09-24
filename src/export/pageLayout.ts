/**
 * Where the diagram goes on the page (SPEC.md §8), in PDF points.
 *
 * Pure arithmetic, kept apart from jsPDF so it can be tested exactly.
 */

export type PageSize = 'a4' | 'letter';
export type Orientation = 'auto' | 'portrait' | 'landscape';

/** Portrait dimensions, in points. */
export const PAGE_SIZES: Readonly<Record<PageSize, { width: number; height: number }>> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

/** Half an inch on every side. */
export const PAGE_MARGIN = 36;

/**
 * The largest scale a diagram is drawn at: one canvas pixel to one point. A
 * small diagram is centred at that size rather than blown up to fill the page,
 * where its text would come out enormous.
 */
export const MAX_SCALE = 1;

export interface PageLayoutInput {
  /** The SVG's size, in drawing units. */
  content: { width: number; height: number };
  pageSize: PageSize;
  orientation: Orientation;
  /** Space reserved at the top for the title header, in points; 0 for none. */
  headerHeight: number;
  margin?: number;
}

export interface PageLayout {
  orientation: 'portrait' | 'landscape';
  page: { width: number; height: number };
  /** The diagram's box on the page, in points. */
  diagram: { x: number; y: number; width: number; height: number };
  scale: number;
}

export function layoutPage(input: PageLayoutInput): PageLayout {
  const margin = input.margin ?? PAGE_MARGIN;
  const { width: contentWidth, height: contentHeight } = input.content;

  // Auto: landscape when the diagram is wider than it is tall (SPEC.md §8).
  const orientation =
    input.orientation === 'auto'
      ? contentWidth > contentHeight
        ? 'landscape'
        : 'portrait'
      : input.orientation;

  const portrait = PAGE_SIZES[input.pageSize];
  const page =
    orientation === 'portrait'
      ? { width: portrait.width, height: portrait.height }
      : { width: portrait.height, height: portrait.width };

  const availableWidth = Math.max(0, page.width - 2 * margin);
  const availableHeight = Math.max(0, page.height - 2 * margin - input.headerHeight);

  const scale =
    contentWidth > 0 && contentHeight > 0
      ? Math.min(availableWidth / contentWidth, availableHeight / contentHeight, MAX_SCALE)
      : MAX_SCALE;

  const width = contentWidth * scale;
  const height = contentHeight * scale;

  return {
    orientation,
    page,
    diagram: {
      // Centred across the page, and hung just below the header.
      x: margin + (availableWidth - width) / 2,
      y: margin + input.headerHeight,
      width,
      height,
    },
    scale,
  };
}
