import { clampScale, DEFAULT_VIEWPORT, type Viewport } from '../model/viewport';

const STORAGE_KEY = 'sticky-notes.viewport.v1';

const PERSIST_DELAY_MS = 400;

export interface ViewportStore {
  get(): Viewport;
  set(next: Viewport): void;
  subscribe(listener: () => void): () => void;
}

const decodeViewport = (value: unknown): Viewport | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { x, y, scale } = value as Record<string, unknown>;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
  return { x: x as number, y: y as number, scale: clampScale(scale as number) };
};

const readViewport = (): Viewport => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_VIEWPORT;
  try {
    return decodeViewport(JSON.parse(raw)) ?? DEFAULT_VIEWPORT;
  } catch {
    return DEFAULT_VIEWPORT;
  }
};

/**
 * The camera lives outside React: panning writes to the DOM sixty times a second, so only
 * the few components that show the zoom level subscribe to it.
 */
export const createViewportStore = (): ViewportStore => {
  let current = readViewport();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const persist = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }, PERSIST_DELAY_MS);
  };

  return {
    get: () => current,

    set(next) {
      if (next.x === current.x && next.y === current.y && next.scale === current.scale) return;
      current = next;
      for (const listener of listeners) listener();
      persist();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const viewportStore = createViewportStore();
