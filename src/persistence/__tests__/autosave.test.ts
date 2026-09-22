import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { clearAutosave, createDebouncer, readAutosave, writeAutosave } from '../autosave';
import { createEmptyDocument } from '../../model/operations';
import type { ErDocument } from '../../model/types';

/** An in-memory stand-in for IndexedDB. */
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: (key: string) => Promise.resolve(store.get(key)),
  set: (key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  },
  del: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8'));
}

describe('autosave', () => {
  beforeEach(() => {
    store.clear();
  });

  it('restores nothing when nothing was ever saved', async () => {
    expect(await readAutosave()).toBeNull();
  });

  it('round-trips a document', async () => {
    const document = createEmptyDocument('Bookstore');
    await writeAutosave(document);
    expect(await readAutosave()).toEqual(document);
  });

  it('restores positions and colours exactly', async () => {
    const document = fixture('university.erd.json') as ErDocument;
    await writeAutosave(document);

    const restored = await readAutosave();
    expect(restored?.layout.positions).toEqual(document.layout.positions);
    expect(restored?.presentation).toEqual(document.presentation);
  });

  it('migrates a document saved by an older version', async () => {
    await writeAutosave(fixture('bookstore-v1.erd.json') as ErDocument);
    const restored = await readAutosave();
    expect(restored?.version).toBe(2);
    expect(restored?.model.entities).toHaveLength(4);
  });

  it('drops a damaged autosave rather than loading a broken model', async () => {
    store.set('chenlab:document', { version: 2, title: 'nope' });
    expect(await readAutosave()).toBeNull();
  });

  it('drops an autosave written by a newer version', async () => {
    store.set('chenlab:document', { ...createEmptyDocument(), version: 99 });
    expect(await readAutosave()).toBeNull();
  });

  it('clears what was saved', async () => {
    await writeAutosave(createEmptyDocument());
    await clearAutosave();
    expect(await readAutosave()).toBeNull();
  });
});

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs once, with the last value, after a burst', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 500);

    debouncer.schedule('a');
    debouncer.schedule('b');
    debouncer.schedule('c');
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledExactlyOnceWith('c');
  });

  it('waits for the gap to elapse', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 500);

    debouncer.schedule('a');
    vi.advanceTimersByTime(400);
    debouncer.schedule('b');
    vi.advanceTimersByTime(400);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('flushes a pending call immediately', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 500);

    debouncer.schedule('a');
    debouncer.flush();
    expect(run).toHaveBeenCalledExactlyOnceWith('a');

    vi.advanceTimersByTime(500);
    expect(run).toHaveBeenCalledOnce();
  });

  it('does nothing when flushed with nothing pending', () => {
    const run = vi.fn();
    createDebouncer(run, 500).flush();
    expect(run).not.toHaveBeenCalled();
  });

  it('cancels a pending call', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 500);

    debouncer.schedule('a');
    debouncer.cancel();
    vi.advanceTimersByTime(500);
    expect(run).not.toHaveBeenCalled();
  });

  it('can be reused after firing', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 500);

    debouncer.schedule('a');
    vi.advanceTimersByTime(500);
    debouncer.schedule('b');
    vi.advanceTimersByTime(500);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith('b');
  });
});
