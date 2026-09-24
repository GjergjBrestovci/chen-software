// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { buildPdf, DEFAULT_PDF_OPTIONS, exportPdf } from '../exportPdf';
import type { PdfOptions } from '../exportPdf';
import { createEmptyDocument, setTitle } from '../../model/operations';
import { readDocumentJson } from '../../persistence/migrations';
import type { ErDocument } from '../../model/types';

/**
 * svg2pdf.js measures with two browser layout APIs jsdom does not implement:
 * SVG `getBBox` and canvas `measureText`. These stubs let it run.
 *
 * What these tests check is structural and independent of the measurements:
 * text is written as PDF text, nothing is an image, the header, the page size,
 * the metadata and the filename. Whether the diagram is laid out correctly on
 * the page is checked by exporting a real PDF from a real browser.
 */
Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => ({ font: '', measureText: (text: string) => ({ width: text.length * 6 }) }),
});

function university(): ErDocument {
  const outcome = readDocumentJson(
    readFileSync(`${process.cwd()}/fixtures/university.erd.json`, 'utf8'),
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.document;
}

/** The raw PDF. jsPDF leaves content streams uncompressed by default, so text is readable. */
async function pdfText(document: ErDocument, options: Partial<PdfOptions> = {}): Promise<string> {
  const pdf = await buildPdf(document, { ...DEFAULT_PDF_OPTIONS, ...options });
  return pdf.output();
}

describe('buildPdf', () => {
  it('produces a PDF', async () => {
    expect((await pdfText(university())).startsWith('%PDF-')).toBe(true);
  });

  it('writes names as text, so they can be selected', async () => {
    const raw = await pdfText(university());
    // `Tj` shows a string as text; a rasterised or outlined diagram would have none.
    for (const name of ['COURSE', 'STUDENT', 'supervises', 'supervisor']) {
      expect(raw).toMatch(new RegExp(`\\(${name}\\) Tj`));
    }
  });

  it('embeds no images, so every line is vector and stays sharp at any zoom', async () => {
    expect(await pdfText(university())).not.toMatch(/\/Subtype\s*\/Image/);
  });

  it('puts the title at the top of the page', async () => {
    const document = setTitle(university(), 'Assignment 3');
    expect(await pdfText(document)).toMatch(/\(Assignment 3\) Tj/);
  });

  it('adds the student name under the title when one is given', async () => {
    const raw = await pdfText(university(), { studentName: 'Ada Lovelace' });
    expect(raw).toMatch(/\(Ada Lovelace\) Tj/);
  });

  it('leaves the header off when asked', async () => {
    const document = setTitle(university(), 'Assignment 3');
    const raw = await pdfText(document, { includeHeader: false, studentName: 'Ada Lovelace' });
    expect(raw).not.toMatch(/\(Assignment 3\) Tj/);
    expect(raw).not.toMatch(/\(Ada Lovelace\) Tj/);
  });

  it('records the title and student in the document properties', async () => {
    const document = setTitle(university(), 'Assignment 3');
    const raw = await pdfText(document, { studentName: 'Ada Lovelace' });
    expect(raw).toMatch(/\/Title \(Assignment 3\)/);
    expect(raw).toMatch(/\/Author \(Ada Lovelace\)/);
  });

  it('falls back to a placeholder title for an untitled diagram', async () => {
    const document = setTitle(university(), '   ');
    expect(await pdfText(document)).toMatch(/\(Untitled diagram\) Tj/);
  });

  it('turns the page for a wide diagram and keeps it upright on request', async () => {
    const wide = await buildPdf(university(), DEFAULT_PDF_OPTIONS);
    const upright = await buildPdf(university(), {
      ...DEFAULT_PDF_OPTIONS,
      orientation: 'portrait',
    });
    const size = (pdf: jsPDF): { width: number; height: number } => ({
      width: pdf.internal.pageSize.getWidth(),
      height: pdf.internal.pageSize.getHeight(),
    });
    expect(size(wide).width).toBeGreaterThan(size(wide).height);
    expect(size(upright).width).toBeLessThan(size(upright).height);
  });

  it('uses the Letter page size when asked', async () => {
    const pdf = await buildPdf(university(), {
      ...DEFAULT_PDF_OPTIONS,
      pageSize: 'letter',
      orientation: 'portrait',
    });
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(612, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(792, 1);
  });

  it('still exports an empty diagram, with just its header', async () => {
    const document = setTitle(createEmptyDocument(), 'Empty');
    const raw = await pdfText(document);
    expect(raw).toMatch(/\(Empty\) Tj/);
  });
});

describe('exportPdf', () => {
  it('saves the PDF under a name derived from the diagram title', async () => {
    // jsPDF applies anything on `jsPDF.API` on top of its built-in methods, and
    // says plugins overriding built-ins is intended. That is the supported way
    // to intercept `save`, which otherwise exists only inside each instance.
    const saved: string[] = [];
    const api = jsPDF.API as unknown as Record<string, unknown>;
    api['save'] = function (this: jsPDF, name: string): jsPDF {
      saved.push(name);
      return this;
    };
    try {
      await exportPdf(setTitle(university(), 'My ER Diagram'), DEFAULT_PDF_OPTIONS);
    } finally {
      delete api['save'];
    }
    expect(saved).toEqual(['my-er-diagram.pdf']);
  });
});
