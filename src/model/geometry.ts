export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const translate = (point: Point, by: Point): Point => ({
  x: point.x + by.x,
  y: point.y + by.y,
});

export const rectFromCorners = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(b.x - a.x),
  height: Math.abs(b.y - a.y),
});

export const rectFromDomRect = (domRect: DOMRect): Rect => ({
  x: domRect.left,
  y: domRect.top,
  width: domRect.width,
  height: domRect.height,
});

export const containsPoint = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

/** Smallest rect covering all of them, or null when there is nothing to cover. */
export const boundingRect = (rects: readonly Rect[]): Rect | null => {
  let bounds: Rect | null = null;
  for (const rect of rects) {
    if (bounds === null) {
      bounds = rect;
      continue;
    }
    const x = Math.min(bounds.x, rect.x);
    const y = Math.min(bounds.y, rect.y);
    bounds = {
      x,
      y,
      width: Math.max(bounds.x + bounds.width, rect.x + rect.width) - x,
      height: Math.max(bounds.y + bounds.height, rect.y + rect.height) - y,
    };
  }
  return bounds;
};
