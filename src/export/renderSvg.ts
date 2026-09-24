import {
  CROWN_PATH,
  MARKER_SIZE,
  PLUG_BODY,
  PLUG_STROKE_PATH,
  markerSlots,
  textBaselineOffset,
  underlineMetrics,
} from '../geometry';
import type { EdgeSegment, ShapeBox } from '../geometry';
import { FILL_OPACITY } from '../model/presentation';
import type { Drawing, DrawnLabel, DrawnShape } from './drawing';

/**
 * Turns a diagram description into an SVG string (SPEC.md §8).
 *
 * Pure, and built only from `describeDiagram` and the shared geometry: the DOM
 * is never screenshotted. The output is always light, whatever theme the
 * screen is in, because a dark page is wrong for a printed hand-in. Text is
 * real `<text>` in Helvetica, the font jsPDF has built in, so the PDF keeps it
 * selectable.
 */

const INK = '#1a1a1a';
const ROLE_INK = '#344054';
const PAPER = '#ffffff';
/**
 * Lower case on purpose. svg2pdf.js matches font names against jsPDF's font
 * list, whose keys are lower case, before lowercasing; "Helvetica" misses and
 * it silently falls back to Times, misaligning every centred name and underline
 * measured for Helvetica. CSS font names ignore case, so browsers do not mind.
 */
const FONT_FAMILY = 'helvetica';
const STROKE_WIDTH = 1.5;
/** Dash pattern for a derived attribute's outline. */
export const OUTLINE_DASH = '5 3';
/** Dash pattern for a partial key's underline. */
export const UNDERLINE_DASH = '3 2';

export interface SvgOptions {
  /** Hide the crown and plug, which are not Chen notation (SPEC.md §6, §8). */
  standardNotation?: boolean;
  /** Blank space kept around the drawing, in drawing units. */
  padding?: number;
}

export interface RenderedSvg {
  svg: string;
  /** Size of the SVG, padding included. Zero for an empty diagram. */
  width: number;
  height: number;
}

const DEFAULT_PADDING = 16;

/** Two decimals is far below anything visible, and keeps the output stable. */
function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Names are the student's own text, so they are escaped before going into markup. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function line(segment: EdgeSegment): string {
  return `<line x1="${n(segment.start.x)}" y1="${n(segment.start.y)}" x2="${n(segment.end.x)}" y2="${n(segment.end.y)}" stroke="${INK}" stroke-width="${n(STROKE_WIDTH)}"/>`;
}

function outline(box: ShapeBox, stroke: string, fill: string, extra: string): string {
  const { x, y } = box.center;
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;
  const paint = `${fill} stroke="${stroke}" stroke-width="${n(STROKE_WIDTH)}"${extra}`;

  switch (box.kind) {
    case 'rect':
      return `<rect x="${n(x - halfWidth)}" y="${n(y - halfHeight)}" width="${n(box.size.width)}" height="${n(box.size.height)}" ${paint}/>`;
    case 'ellipse':
      return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(halfWidth)}" ry="${n(halfHeight)}" ${paint}/>`;
    case 'diamond':
      return `<polygon points="${n(x)},${n(y - halfHeight)} ${n(x + halfWidth)},${n(y)} ${n(x)},${n(y + halfHeight)} ${n(x - halfWidth)},${n(y)}" ${paint}/>`;
  }
}

function shapeMarkup(shape: DrawnShape, standardNotation: boolean): string {
  const stroke = shape.color ?? INK;
  // Solid outline, 12% fill of the same colour (SPEC.md §6). No colour means ink on paper.
  const fill =
    shape.color === null
      ? `fill="${PAPER}"`
      : `fill="${shape.color}" fill-opacity="${n(FILL_OPACITY)}"`;
  const dash = shape.dashed ? ` stroke-dasharray="${OUTLINE_DASH}"` : '';

  const parts = [outline(shape.box, stroke, fill, dash)];
  if (shape.inner) {
    parts.push(outline(shape.inner, stroke, 'fill="none"', ''));
  }

  const baseline = shape.box.center.y + textBaselineOffset(shape.fontSize);
  parts.push(
    `<text x="${n(shape.box.center.x)}" y="${n(baseline)}" font-family="${FONT_FAMILY}" font-size="${n(shape.fontSize)}" text-anchor="middle" fill="${INK}">${escapeXml(shape.name)}</text>`,
  );

  if (shape.underline !== 'none') {
    const rule = underlineMetrics(shape.name, shape.fontSize);
    const y = baseline + rule.offset;
    const underlineDash =
      shape.underline === 'dashed' ? ` stroke-dasharray="${UNDERLINE_DASH}"` : '';
    parts.push(
      `<line x1="${n(shape.box.center.x - rule.width / 2)}" y1="${n(y)}" x2="${n(shape.box.center.x + rule.width / 2)}" y2="${n(y)}" stroke="${INK}" stroke-width="${n(rule.thickness)}"${underlineDash}/>`,
    );
  }

  if (!standardNotation) {
    markerSlots(shape.box, shape.markers.length).forEach((slot, index) => {
      const x = shape.box.center.x + slot.x - MARKER_SIZE.width / 2;
      const y = shape.box.center.y + slot.y - MARKER_SIZE.height / 2;
      const at = `transform="translate(${n(x)},${n(y)})"`;
      parts.push(
        shape.markers[index] === 'key'
          ? `<path ${at} d="${CROWN_PATH}" fill="${stroke}"/>`
          : `<g ${at}><rect x="${n(PLUG_BODY.x)}" y="${n(PLUG_BODY.y)}" width="${n(PLUG_BODY.width)}" height="${n(PLUG_BODY.height)}" rx="${n(PLUG_BODY.radius)}" fill="${stroke}"/><path d="${PLUG_STROKE_PATH}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/></g>`,
      );
    });
  }

  return parts.join('');
}

function labelMarkup(label: DrawnLabel): string {
  const baseline = label.position.y + textBaselineOffset(label.fontSize);
  const style =
    label.kind === 'cardinality'
      ? `font-weight="bold" fill="${INK}"`
      : `font-style="italic" fill="${ROLE_INK}"`;
  return `<text x="${n(label.position.x)}" y="${n(baseline)}" font-family="${FONT_FAMILY}" font-size="${n(label.fontSize)}" text-anchor="middle" ${style}>${escapeXml(label.text)}</text>`;
}

export function renderSvg(drawing: Drawing, options: SvgOptions = {}): RenderedSvg {
  const padding = options.padding ?? DEFAULT_PADDING;
  const standardNotation = options.standardNotation ?? false;

  if (!drawing.bounds) {
    return {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0"></svg>',
      width: 0,
      height: 0,
    };
  }

  const minX = drawing.bounds.minX - padding;
  const minY = drawing.bounds.minY - padding;
  const width = drawing.bounds.maxX - drawing.bounds.minX + 2 * padding;
  const height = drawing.bounds.maxY - drawing.bounds.minY + 2 * padding;

  // Lines first, so shapes sit on top of the ends that meet them.
  const body = [
    ...drawing.lines.map(line),
    ...drawing.shapes.map((shape) => shapeMarkup(shape, standardNotation)),
    ...drawing.labels.map(labelMarkup),
  ].join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(minX)} ${n(minY)} ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}">${body}</svg>`;
  return { svg, width, height };
}
