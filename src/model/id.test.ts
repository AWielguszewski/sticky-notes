import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from './id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('randomId', () => {
  it('looks like a uuid and does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 200 }, randomId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('still hands out ids where randomUUID is not offered', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });

    const ids = new Set(Array.from({ length: 50 }, randomId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });
});
