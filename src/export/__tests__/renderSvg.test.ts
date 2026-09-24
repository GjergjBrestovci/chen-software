// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { describeDiagram } from '../drawing';
import { escapeXml, OUTLINE_DASH, renderSvg, UNDERLINE_DASH } from '../renderSvg';
import { FILL_OPACITY } from '../../model/presentation';
import {
  addAttribute,
  addEntity,
  createEmptyDocument,
  setElementColor,
} from '../../model/operations';
import { readDocumentJson } from '../../persistence/migrations';
import type { ErDocument } from '../../model/types';

function university(): ErDocument {
  const outcome = readDocumentJson(
    readFileSync(`${process.cwd()}/fixtures/university.erd.json`, 'utf8'),
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.document;
}

/** Parses the SVG the way the browser, and svg2pdf, will. */
function parse(svg: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  const root = document.documentElement;
  if (!(root instanceof SVGSVGElement)) throw new Error('not an svg root');
  return root;
}

function texts(root: Element): string[] {
  return [...root.querySelectorAll('text')].map((node) => node.textContent);
}

describe('renderSvg', () => {
  const drawing = describeDiagram(university());
  const rendered = renderSvg(drawing);
  const root = parse(rendered.svg);

  it('produces well-formed SVG', () => {
    expect(root.tagName).toBe('svg');
  });

  it('frames the whole drawing plus padding', () => {
    const bounds = drawing.bounds;
    if (!bounds) throw new Error('expected bounds');
    expect(rendered.width).toBeCloseTo(bounds.maxX - bounds.minX + 32, 6);
    expect(rendered.height).toBeCloseTo(bounds.maxY - bounds.minY + 32, 6);
    expect(root.getAttribute('viewBox')?.split(' ')).toHaveLength(4);
  });

  it('writes every name and label as real text, so the PDF keeps it selectable', () => {
    const all = texts(root);
    expect(all).toContain('COURSE');
    expect(all).toContain('supervises');
    expect(all).toContain('supervisor');
    expect(all).toHaveLength(drawing.shapes.length + drawing.labels.length);
  });

  it('names Helvetica in the lower case svg2pdf.js can match', () => {
    // exportPdf.test.ts checks the font the PDF actually uses.
    for (const node of root.querySelectorAll('text')) {
      expect(node.getAttribute('font-family')).toBe('helvetica');
    }
  });

  it('sets cardinalities bold and role names in italics', () => {
    const byText = (text: string): Element | undefined =>
      [...root.querySelectorAll('text')].find((node) => node.textContent === text);
    expect(byText('supervisor')?.getAttribute('font-style')).toBe('italic');
    const cardinality = [...root.querySelectorAll('text')].find(
      (node) => node.getAttribute('font-weight') === 'bold',
    );
    expect(['1', 'N', 'M', '?']).toContain(cardinality?.textContent);
  });

  it('draws a second outline for each doubled shape', () => {
    const doubled = drawing.shapes.filter((shape) => shape.inner !== null).length;
    const outlines = root.querySelectorAll('rect, ellipse, polygon').length;
    const markerRects = root.querySelectorAll('g rect').length;
    expect(outlines - markerRects).toBe(drawing.shapes.length + doubled);
  });

  it('dashes the derived attribute outline', () => {
    expect(root.querySelectorAll(`[stroke-dasharray="${OUTLINE_DASH}"]`)).toHaveLength(1);
  });

  it('dashes a partial key underline', () => {
    expect(root.querySelectorAll(`line[stroke-dasharray="${UNDERLINE_DASH}"]`)).toHaveLength(1);
  });

  it('draws the lines before the shapes, so shapes cover the ends that meet them', () => {
    const children = [...root.children];
    const lastLine = children.map((child) => child.tagName).lastIndexOf('line');
    const firstShape = children.findIndex((child) => child.tagName !== 'line');
    expect(firstShape).toBe(drawing.lines.length);
    expect(lastLine).toBeGreaterThan(firstShape);
  });

  it('includes the crown and plug markers by default', () => {
    expect(root.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('is always light, whatever theme the screen is in', () => {
    expect(rendered.svg).not.toMatch(/#16181c|#1c1f24|#202329/);
    expect(rendered.svg).toContain('fill="#ffffff"');
  });
});

describe('renderSvg options and edge cases', () => {
  it('leaves out the crown and plug in standard Chen notation', () => {
    let document = addEntity(createEmptyDocument(), {
      id: 'a',
      name: 'A',
      position: { x: 0, y: 0 },
    });
    document = addAttribute(document, {
      id: 'k',
      ownerId: 'a',
      name: 'k',
      identifier: 'key',
      foreignKey: true,
      offset: { x: 0, y: 120 },
    });
    const drawing = describeDiagram(document);

    const marked = parse(renderSvg(drawing).svg);
    const standard = parse(renderSvg(drawing, { standardNotation: true }).svg);

    expect(marked.querySelectorAll('path')).toHaveLength(2);
    expect(standard.querySelectorAll('path')).toHaveLength(0);
    // The underline is Chen notation, so it stays.
    expect(standard.querySelectorAll('line').length).toBeGreaterThanOrEqual(1);
  });

  it('draws a coloured component with a solid outline and a translucent fill', () => {
    const document = setElementColor(
      addEntity(createEmptyDocument(), { id: 'a', name: 'A', position: { x: 0, y: 0 } }),
      'a',
      '#2563eb',
    );
    const rect = parse(renderSvg(describeDiagram(document)).svg).querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('#2563eb');
    expect(rect?.getAttribute('fill')).toBe('#2563eb');
    expect(Number(rect?.getAttribute('fill-opacity'))).toBeCloseTo(FILL_OPACITY, 6);
  });

  it('escapes the characters XML reserves, so any name is safe', () => {
    const name = `Tom & Jerry's <"Shop">`;
    const document = addEntity(createEmptyDocument(), {
      id: 'a',
      name,
      position: { x: 0, y: 0 },
    });
    const root = parse(renderSvg(describeDiagram(document)).svg);
    expect(texts(root)).toEqual([name]);
  });

  it('honours custom padding', () => {
    const drawing = describeDiagram(university());
    const tight = renderSvg(drawing, { padding: 0 });
    const loose = renderSvg(drawing, { padding: 50 });
    expect(loose.width - tight.width).toBeCloseTo(100, 6);
  });

  it('renders an empty diagram as an empty, zero-sized SVG', () => {
    const rendered = renderSvg(describeDiagram(createEmptyDocument()));
    expect(rendered.width).toBe(0);
    expect(rendered.height).toBe(0);
    expect(parse(rendered.svg).children).toHaveLength(0);
  });

  it('is deterministic', () => {
    const drawing = describeDiagram(university());
    expect(renderSvg(drawing).svg).toBe(renderSvg(drawing).svg);
  });
});

describe('escapeXml', () => {
  it('escapes all five reserved characters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeXml('publication_date')).toBe('publication_date');
  });
});
