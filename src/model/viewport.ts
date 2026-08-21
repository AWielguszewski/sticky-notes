import { clamp, type Point, type Rect, type Size } from './geometry';

/** Transform between world coordinates, where notes live, and the pixels on screen. */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const MIN_SCALE = 0.1;

export const MAX_SCALE = 4;

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export const clampScale = (scale: number): number => clamp(scale, MIN_SCALE, MAX_SCALE);

/** Point relative to the viewport element, into world coordinates. */
export const toWorld = (viewport: Viewport, point: Point): Point => ({
  x: (point.x - viewport.x) / viewport.scale,
  y: (point.y - viewport.y) / viewport.scale,
});

export const toScreen = (viewport: Viewport, point: Point): Point => ({
  x: point.x * viewport.scale + viewport.x,
  y: point.y * viewport.scale + viewport.y,
});

/** Pointer travel is measured in screen pixels; notes move in world units. */
export const deltaToWorld = (viewport: Viewport, delta: Point): Point => ({
  x: delta.x / viewport.scale,
  y: delta.y / viewport.scale,
});

export const panBy = (viewport: Viewport, by: Point): Viewport => ({
  ...viewport,
  x: viewport.x + by.x,
  y: viewport.y + by.y,
});

/** Scales around a pivot, so whatever sits under it stays where it is. */
export const zoomTo = (viewport: Viewport, pivot: Point, scale: number): Viewport => {
  const next = clampScale(scale);
  const ratio = next / viewport.scale;
  return {
    x: pivot.x - (pivot.x - viewport.x) * ratio,
    y: pivot.y - (pivot.y - viewport.y) * ratio,
    scale: next,
  };
};

export const zoomBy = (viewport: Viewport, pivot: Point, factor: number): Viewport =>
  zoomTo(viewport, pivot, viewport.scale * factor);

export const visibleRect = (viewport: Viewport, view: Size): Rect => ({
  x: -viewport.x / viewport.scale,
  y: -viewport.y / viewport.scale,
  width: view.width / viewport.scale,
  height: view.height / viewport.scale,
});

/** Centres the rect in the view, as large as the zoom limits allow. */
export const fitToRect = (rect: Rect, view: Size, padding: number): Viewport => {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const scale = clampScale(
    Math.min((view.width - padding * 2) / width, (view.height - padding * 2) / height),
  );
  return {
    x: (view.width - width * scale) / 2 - rect.x * scale,
    y: (view.height - height * scale) / 2 - rect.y * scale,
    scale,
  };
};
