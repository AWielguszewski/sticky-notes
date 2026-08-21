import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  MAX_SCALE,
  MIN_SCALE,
  deltaToWorld,
  fitToRect,
  panBy,
  toScreen,
  toWorld,
  visibleRect,
  zoomTo,
  type Viewport,
} from './viewport';

const viewport: Viewport = { x: -120, y: 40, scale: 2 };

describe('toWorld and toScreen', () => {
  it('are inverses of each other', () => {
    const point = { x: 33, y: -17 };
    expect(toWorld(viewport, toScreen(viewport, point))).toEqual(point);
  });

  it('maps the top left of the view to the panned world point', () => {
    expect(toWorld(viewport, { x: 0, y: 0 })).toEqual({ x: 60, y: -20 });
  });
});

describe('deltaToWorld', () => {
  it('shrinks pointer travel when zoomed in', () => {
    expect(deltaToWorld(viewport, { x: 30, y: -10 })).toEqual({ x: 15, y: -5 });
  });
});

describe('panBy', () => {
  it('moves the camera and leaves the zoom alone', () => {
    expect(panBy(viewport, { x: 20, y: 5 })).toEqual({ x: -100, y: 45, scale: 2 });
  });
});

describe('zoomTo', () => {
  it('keeps whatever is under the pivot in place', () => {
    const pivot = { x: 400, y: 250 };
    const anchored = toWorld(viewport, pivot);
    const zoomed = toScreen(zoomTo(viewport, pivot, 3.5), anchored);
    expect(zoomed.x).toBeCloseTo(pivot.x);
    expect(zoomed.y).toBeCloseTo(pivot.y);
  });

  it('stays within the zoom limits', () => {
    const pivot = { x: 0, y: 0 };
    expect(zoomTo(DEFAULT_VIEWPORT, pivot, 99).scale).toBe(MAX_SCALE);
    expect(zoomTo(DEFAULT_VIEWPORT, pivot, 0.001).scale).toBe(MIN_SCALE);
  });
});

describe('fitToRect', () => {
  const rect = { x: 100, y: 100, width: 400, height: 300 };
  const view = { width: 1000, height: 600 };

  it('centres the rect in the view', () => {
    const fitted = fitToRect(rect, view, 50);
    const topLeft = toScreen(fitted, rect);
    const bottomRight = toScreen(fitted, {
      x: rect.x + rect.width,
      y: rect.y + rect.height,
    });
    expect(topLeft.x + bottomRight.x).toBeCloseTo(view.width);
    expect(topLeft.y + bottomRight.y).toBeCloseTo(view.height);
  });

  it('leaves at least the padding around the rect', () => {
    const fitted = fitToRect(rect, view, 50);
    expect(toScreen(fitted, rect).x).toBeGreaterThanOrEqual(50);
    expect(toScreen(fitted, rect).y).toBeGreaterThanOrEqual(50);
  });
});

describe('visibleRect', () => {
  it('covers what the view shows in world units', () => {
    expect(visibleRect({ x: -100, y: -50, scale: 2 }, { width: 800, height: 600 })).toEqual({
      x: 50,
      y: 25,
      width: 400,
      height: 300,
    });
  });
});
