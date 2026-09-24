import type { Orientation, PageSize } from './pageLayout';

/**
 * PDF export options (SPEC.md §8), kept apart from `exportPdf.ts` so the UI can
 * hold and remember them without pulling jsPDF into the main bundle. jsPDF is
 * loaded only when the student actually exports.
 */
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
