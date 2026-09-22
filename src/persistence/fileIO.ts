import { messages } from '../i18n/messages.en';
import { placeMissingPositions } from '../layout/placement';
import type { ErDocument, Id } from '../model/types';
import { readDocumentJson } from './migrations';

/**
 * Reading and writing `.erd.json` files (SPEC.md §8).
 *
 * A malformed file is rejected whole; nothing is ever partially loaded. An
 * element with no saved position is not malformed, so it is placed and the
 * student is told how many were moved.
 */

export const FILE_EXTENSION = '.erd.json';
export const FILE_MIME_TYPE = 'application/json';

/** A filename derived from the diagram title, safe on every platform. */
export function fileNameFor(title: string): string {
  const cleaned = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${cleaned.length > 0 ? cleaned : 'diagram'}${FILE_EXTENSION}`;
}

/** The exact bytes written to disk. Pure, so a test can assert them. */
export function serializeDocument(document: ErDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export interface OpenedDocument {
  document: ErDocument;
  /** Elements that had no saved position and were placed. */
  placedIds: Id[];
}

export type OpenOutcome = { ok: true; value: OpenedDocument } | { ok: false; message: string };

/**
 * Parses, migrates, validates and repairs the contents of an `.erd.json` file.
 * Pure: the caller does the file and DOM work.
 */
export function openDocumentText(text: string): OpenOutcome {
  const parsed = readDocumentJson(text);
  if (!parsed.ok) {
    return parsed;
  }

  const { document, missingPositionIds } = parsed.value;
  return {
    ok: true,
    value: {
      document: placeMissingPositions(document, missingPositionIds),
      placedIds: missingPositionIds,
    },
  };
}

/** Message shown after opening a file that needed elements placed. */
export function placementNotice(placedIds: readonly Id[]): string | null {
  return placedIds.length === 0 ? null : messages.file.placedMissingPositions(placedIds.length);
}

/**
 * Opens the system file picker and resolves with the chosen file, or `null` if
 * the student cancelled. The input is created and discarded here rather than
 * living in the page, so no component has to hold a ref to it.
 */
export function pickDocumentFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = globalThis.document.createElement('input');
    input.type = 'file';
    input.accept = `.json,${FILE_MIME_TYPE}`;
    input.hidden = true;
    // Attached rather than detached: not every browser opens the picker for an
    // input that is not in the document.
    globalThis.document.body.append(input);

    const finish = (file: File | null): void => {
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });
    // Fired when the picker is dismissed without choosing anything.
    input.addEventListener('cancel', () => {
      finish(null);
    });

    input.click();
  });
}

/** Hands the document to the browser as a download. */
export function downloadDocument(document: ErDocument): void {
  const blob = new Blob([serializeDocument(document)], { type: FILE_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');

  link.href = url;
  link.download = fileNameFor(document.title);
  link.rel = 'noopener';
  globalThis.document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
