import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SCALE } from '../model/viewport';
import { createViewportStore } from './viewportStore';

const STORAGE_KEY = 'sticky-notes.viewport.v1';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createViewportStore', () => {
  it('starts at the origin without a stored camera', () => {
    expect(createViewportStore().get()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('restores a stored camera', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: -40, y: 12, scale: 2 }));
    expect(createViewportStore().get()).toEqual({ x: -40, y: 12, scale: 2 });
  });

  it('pulls a stored zoom back into range', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 0, y: 0, scale: 900 }));
    expect(createViewportStore().get().scale).toBe(MAX_SCALE);
  });

  it('falls back to the origin for anything unreadable', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(createViewportStore().get()).toEqual({ x: 0, y: 0, scale: 1 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 'left', y: 0, scale: 1 }));
    expect(createViewportStore().get()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('persists once the camera settles', async () => {
    const store = createViewportStore();
    store.set({ x: 10, y: 20, scale: 2 });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await vi.advanceTimersByTimeAsync(500);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      x: 10,
      y: 20,
      scale: 2,
    });
  });

  it('notifies subscribers, but not about a camera that did not move', () => {
    const store = createViewportStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.set({ x: 5, y: 5, scale: 1 });
    store.set({ x: 5, y: 5, scale: 1 });
    expect(calls).toBe(1);

    unsubscribe();
    store.set({ x: 9, y: 9, scale: 1 });
    expect(calls).toBe(1);
  });
});
