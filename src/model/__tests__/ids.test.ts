import { afterEach, describe, expect, it } from 'vitest';
import { createId, resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../ids';

describe('ids', () => {
  afterEach(() => {
    resetIdGenerator();
  });

  it('produces distinct ids by default', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()));
    expect(ids.size).toBe(200);
  });

  it('produces non-empty ids by default', () => {
    expect(createId().length).toBeGreaterThan(0);
  });

  it('uses an injected generator', () => {
    setIdGenerator(sequentialIdGenerator('e'));
    expect([createId(), createId(), createId()]).toEqual(['e1', 'e2', 'e3']);
  });

  it('restores the default generator', () => {
    setIdGenerator(() => 'fixed');
    expect(createId()).toBe('fixed');
    resetIdGenerator();
    expect(createId()).not.toBe('fixed');
  });

  it('defaults the sequential prefix', () => {
    const next = sequentialIdGenerator();
    expect(next()).toBe('id1');
  });
});
