import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { messages } from '../i18n/messages.en';
import type { ErDocument } from '../model/types';
import { fileNameFor } from '../persistence/fileIO';
import { describeDiagram } from './drawing';
import { layoutPage, PAGE_MARGIN } from './pageLayout';
import type { Orientation, PageSize } from './pageLayout';
import { renderSvg } from './renderSvg';

/**
 * Vector PDF export (SPEC.md §8): the diagram as an SVG, converted by svg2pdf.js
 * into jsPDF drawing and text operators. Nothing is rasterised, so lines stay
 * sharp at any zoom and the text can be selected.
 */

export const PDF_EXTENSION = '.pdf';

export interface PdfOptions {
  pageSize: PageSize;
  orientation: Orientation;
  /** Leave out the crown and plug, which are not Chen notation. */
  standardNotation: boolean;
  /** Put the diagram title, and the student's name if given, at the top. */
  includeHeader: boolean;
  studentName: string;
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  pageSize: 'a4',
  orientation: 'auto',
  standardNotation: false,
  includeHeader: true,
  studentName: '',
};

const TITLE_SIZE = 16;
const NAME_SIZE = 11;
const LINE_GAP = 4;
/** Space between the header and the diagram. */
const HEADER_GAP = 16;

function headerHeight(options: PdfOptions): number {
  if (!options.includeHeader) {
    return 0;
  }
  const nameHeight = options.studentName.trim().length > 0 ? LINE_GAP + NAME_SIZE : 0;
  return TITLE_SIZE + nameHeight + HEADER_GAP;
}

/** Builds the PDF without saving it, so the result can be inspected. */
export async function buildPdf(document: ErDocument, options: PdfOptions): Promise<jsPDF> {
  const title = document.title.trim().length > 0 ? document.title : messages.document.untitled;
  const studentName = options.studentName.trim();

  const rendered = renderSvg(describeDiagram(document), {
    standardNotation: options.standardNotation,
  });
  const layout = layoutPage({
    content: rendered,
    pageSize: options.pageSize,
    orientation: options.orientation,
    headerHeight: headerHeight(options),
  });

  const pdf = new jsPDF({
    unit: 'pt',
    format: options.pageSize,
    orientation: layout.orientation,
  });
  pdf.setProperties({ title, author: studentName, creator: messages.app.title });

  if (options.includeHeader) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(TITLE_SIZE);
    pdf.text(title, PAGE_MARGIN, PAGE_MARGIN, { baseline: 'top' });

    if (studentName.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(NAME_SIZE);
      pdf.text(studentName, PAGE_MARGIN, PAGE_MARGIN + TITLE_SIZE + LINE_GAP, {
        baseline: 'top',
      });
    }
  }

  // An empty diagram still gets its header, just nothing below it.
  if (rendered.width > 0) {
    const svg = new DOMParser().parseFromString(rendered.svg, 'image/svg+xml').documentElement;
    await svg2pdf(svg, pdf, layout.diagram);
  }

  return pdf;
}

/** Builds the PDF and hands it to the browser as a download named after the diagram. */
export async function exportPdf(document: ErDocument, options: PdfOptions): Promise<void> {
  const pdf = await buildPdf(document, options);
  pdf.save(fileNameFor(document.title, PDF_EXTENSION));
}
