/**
 * Deterministic Helvetica text measurement.
 *
 * SPEC.md §8 forbids screenshotting the DOM: `renderSvg` must lay the diagram
 * out by itself, in Node, and produce the same geometry the student saw on
 * screen. So measurement cannot use `CanvasRenderingContext2D.measureText` or
 * `getBBox`. These are the Adobe Helvetica advance widths, in 1/1000 em, which
 * is also the font jsPDF has built in (SPEC.md §8).
 */
import type { Size } from './types';

/** Advance width used for any character missing from the table. */
const FALLBACK_ADVANCE = 556;

const ADVANCE_WIDTHS: Readonly<Record<string, number>> = buildAdvanceWidths();

function buildAdvanceWidths(): Record<string, number> {
  const table: Record<string, number> = {};
  const assign = (characters: string, advance: number): void => {
    for (const character of characters) {
      table[character] = advance;
    }
  };

  assign("'", 191);
  assign('ijl', 222);
  assign('|', 260);
  assign(' !,./:;I[]\\ft', 278);
  assign('()-`r', 333);
  assign('{}', 334);
  assign('"', 355);
  assign('*', 389);
  assign('^', 469);
  assign('Jcksvxyz', 500);
  assign('#$_0123456789?Labdeghnopqu', 556);
  assign('+<=>~', 584);
  assign('FTZ', 611);
  assign('&ABEKPSVXY', 667);
  assign('CDHNRUw', 722);
  assign('GOQ', 778);
  assign('Mm', 833);
  assign('%', 889);
  assign('W', 944);
  assign('@', 1015);

  // German characters, so the planned translation (SPEC.md §2) measures correctly.
  assign('äöüß', 556);
  assign('Ä', 667);
  assign('Ö', 778);
  assign('Ü', 722);

  return table;
}

/** Default font size per shape kind lives in `sizing.ts`; this is the fallback. */
export const DEFAULT_FONT_SIZE = 13;

/** Helvetica cap height, in 1/1000 em. */
const CAP_HEIGHT_RATIO = 0.718;

/** Line box height as a multiple of the font size. */
export const LINE_HEIGHT_RATIO = 1.2;

/** Helvetica underline position and thickness, in 1/1000 em. */
const UNDERLINE_OFFSET_RATIO = 0.1;
const UNDERLINE_THICKNESS_RATIO = 0.05;

/** Width of one line of text, in pixels. */
export function measureTextWidth(text: string, fontSize: number = DEFAULT_FONT_SIZE): number {
  let advance = 0;
  for (const character of text) {
    advance += ADVANCE_WIDTHS[character] ?? FALLBACK_ADVANCE;
  }
  return (advance / 1000) * fontSize;
}

/** Width and height of one line of text, in pixels. */
export function textBoxSize(text: string, fontSize: number = DEFAULT_FONT_SIZE): Size {
  return { width: measureTextWidth(text, fontSize), height: textLineHeight(fontSize) };
}

/** Height of one line box, in pixels. */
export function textLineHeight(fontSize: number = DEFAULT_FONT_SIZE): number {
  return fontSize * LINE_HEIGHT_RATIO;
}

/**
 * Distance from the vertical centre of a shape down to the text baseline.
 *
 * Half the cap height, which centres capitalised entity names the way a reader
 * expects. Returned explicitly rather than relying on `dominant-baseline`,
 * which svg2pdf.js does not reproduce reliably.
 */
export function textBaselineOffset(fontSize: number = DEFAULT_FONT_SIZE): number {
  return (fontSize * CAP_HEIGHT_RATIO) / 2;
}

export interface UnderlineMetrics {
  /** Width of the rule, matching the text it sits under. */
  width: number;
  /** Distance below the baseline to the top of the rule. */
  offset: number;
  thickness: number;
}

/** Rule under a key attribute's name (SPEC.md §5). */
export function underlineMetrics(
  text: string,
  fontSize: number = DEFAULT_FONT_SIZE,
): UnderlineMetrics {
  return {
    width: measureTextWidth(text, fontSize),
    offset: fontSize * UNDERLINE_OFFSET_RATIO,
    thickness: Math.max(1, fontSize * UNDERLINE_THICKNESS_RATIO),
  };
}
