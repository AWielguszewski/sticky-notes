import type { Point } from './geometry';

/** What the fingers currently on the glass add up to, once one of them has moved. */
export type TouchAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'pan'; readonly by: Point }
  | {
      readonly kind: 'pinch';
      /** Midpoint between the two fingers, in the same coordinates they were given in. */
      readonly centre: Point;
      readonly factor: number;
      readonly by: Point;
    };

export interface TouchGesture {
  /**
   * `primary` is the browser's own word for "no other finger was already down". When it says
   * so and this tracker is still holding touches, those are fingers whose release never
   * arrived, and they go before the new one is written down.
   */
  down(id: number, point: Point, background: boolean, primary: boolean): void;
  move(id: number, point: Point): TouchAction;
  up(id: number): void;
  /** Forgets every finger: for when the page is put aside mid-gesture. */
  clear(): void;
  readonly size: number;
}

interface Touching {
  point: Point;
  background: boolean;
}

const NONE: TouchAction = { kind: 'none' };

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Reads a set of fingers as either a drag of the board or a pinch of it. One on the
 * background drags, two anywhere pinch, anything else waits. Both come out as increments,
 * which keeps a pinch that also travels from fighting itself.
 *
 * It is deliberately blind to the DOM. A touch whose release never arrives is a fact of
 * touch screens — the element holding the implicit capture can be taken out from under it,
 * which is what happens when a note is dropped on the bin — so rather than trust that every
 * finger reports back, the tracker throws away what it holds the moment the browser tells it
 * the glass was clear.
 */
export function createTouchGesture(): TouchGesture {
  const touches = new Map<number, Touching>();
  let spread = 0;
  let centre: Point | null = null;

  const pair = (): [Touching, Touching] | null => {
    const both = [...touches.values()];
    const [first, second] = both;
    return both.length === 2 && first !== undefined && second !== undefined
      ? [first, second]
      : null;
  };

  const forget = (): void => {
    touches.clear();
    spread = 0;
    centre = null;
  };

  const remember = (): void => {
    const both = pair();
    if (both === null) {
      spread = 0;
      centre = null;
      return;
    }
    spread = distance(both[0].point, both[1].point);
    centre = midpoint(both[0].point, both[1].point);
  };

  const pinched = (both: [Touching, Touching]): TouchAction => {
    const wasSpread = spread;
    const wasCentre = centre;
    spread = distance(both[0].point, both[1].point);
    centre = midpoint(both[0].point, both[1].point);
    // The first move of a pinch only seeds it; there is nothing yet to measure against.
    if (wasSpread <= 0 || wasCentre === null) return NONE;
    return {
      kind: 'pinch',
      centre,
      factor: spread / wasSpread,
      by: { x: centre.x - wasCentre.x, y: centre.y - wasCentre.y },
    };
  };

  return {
    get size() {
      return touches.size;
    },

    down(id, point, background, primary) {
      if (primary) forget();
      touches.set(id, { point, background });
      remember();
    },

    move(id, point) {
      const touching = touches.get(id);
      if (touching === undefined) return NONE;
      const was = touching.point;
      touching.point = point;

      const both = pair();
      if (both !== null) return pinched(both);

      if (!touching.background) return NONE;
      return { kind: 'pan', by: { x: point.x - was.x, y: point.y - was.y } };
    },

    up(id) {
      if (!touches.delete(id)) return;
      remember();
    },

    clear: forget,
  };
}
