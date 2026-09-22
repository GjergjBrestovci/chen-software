// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadDocument, FILE_MIME_TYPE, pickDocumentFile, serializeDocument } from '../fileIO';
import { createEmptyDocument } from '../../model/operations';

/** jsdom implements neither object URL, so the download path needs stubs. */
function stubObjectUrl(): { created: Blob[]; revoked: string[] } {
  const created: Blob[] = [];
  const revoked: string[] = [];

  URL.createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return `blob:fake/${String(created.length)}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });

  return { created, revoked };
}

function readBlob(blob: Blob | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject(new Error('no blob was created'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // readAsText always yields a string.
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error('could not read the blob'));
    };
    reader.readAsText(blob);
  });
}

describe('downloadDocument', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands the browser a JSON blob named after the diagram', async () => {
    const { created } = stubObjectUrl();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    const document_ = createEmptyDocument('Bookstore');
    downloadDocument(document_);

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('bookstore.erd.json');
    expect(created[0]?.type).toBe(FILE_MIME_TYPE);
    // jsdom's Blob has no text(); FileReader is what it does implement.
    expect(await readBlob(created[0])).toBe(serializeDocument(document_));
  });

  it('cleans up the link and the object URL', () => {
    const { revoked } = stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadDocument(createEmptyDocument('Bookstore'));

    expect(document.querySelectorAll('a')).toHaveLength(0);
    expect(revoked).toHaveLength(1);
  });
});

describe('pickDocumentFile', () => {
  let opened: HTMLInputElement | null = null;

  beforeEach(() => {
    opened = null;
    // The picker attaches its input to the body, so it can be found by query
    // rather than by aliasing `this` inside the mock.
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
      opened = document.body.querySelector('input[type="file"]');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a picker that accepts diagram files', async () => {
    const pending = pickDocumentFile();
    expect(opened).not.toBeNull();
    expect(opened?.type).toBe('file');
    expect(opened?.accept).toContain(FILE_MIME_TYPE);

    opened?.dispatchEvent(new Event('cancel'));
    await pending;
  });

  it('resolves with the chosen file', async () => {
    const pending = pickDocumentFile();
    const file = new File(['{}'], 'diagram.erd.json', { type: FILE_MIME_TYPE });

    Object.defineProperty(opened, 'files', { value: [file], configurable: true });
    opened?.dispatchEvent(new Event('change'));

    expect(await pending).toBe(file);
  });

  it('resolves with nothing when the picker is dismissed', async () => {
    const pending = pickDocumentFile();
    opened?.dispatchEvent(new Event('cancel'));
    expect(await pending).toBeNull();
  });

  it('resolves with nothing when the change carries no file', async () => {
    const pending = pickDocumentFile();
    Object.defineProperty(opened, 'files', { value: [], configurable: true });
    opened?.dispatchEvent(new Event('change'));
    expect(await pending).toBeNull();
  });

  it('removes the input once it is done with', async () => {
    const pending = pickDocumentFile();
    opened?.dispatchEvent(new Event('cancel'));
    await pending;
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });
});
