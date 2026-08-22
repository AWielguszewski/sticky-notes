import { useEffect, useRef, type RefObject } from 'react';
import type { Point } from '../model/geometry';

export interface CanvasTouchHandlers {
  /** True when the press landed on the board itself rather than on a note. */
  isBackground: (target: EventTarget | null) => boolean;
  onPan: (by: Point) => void;
  onPinch: (pivot: Point, factor: number, by: Point) => void;
}

interface Touching {
  point: Point;
  background: boolean;
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Touch has no middle button and no modifier keys, so the board reads fingers instead: one on
 * the background drags it, two anywhere pinch it. Both are fed in as increments, which keeps
 * a pinch that also travels from fighting itself.
 */
export function useCanvasTouch(
  ref: RefObject<HTMLElement | null>,
  handlers: CanvasTouchHandlers,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const touches = new Map<number, Touching>();
    let spread = 0;
    let centre: Point | null = null;

    const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

    const pinchOf = (): [Touching, Touching] | null => {
      const both = [...touches.values()];
      const [first, second] = both;
      return both.length === 2 && first !== undefined && second !== undefined
        ? [first, second]
        : null;
    };

    const remember = (): void => {
      const pinch = pinchOf();
      if (pinch === null) {
        spread = 0;
        centre = null;
        return;
      }
      spread = distance(pinch[0].point, pinch[1].point);
      centre = midpoint(pinch[0].point, pinch[1].point);
    };

    const handleDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') return;
      touches.set(event.pointerId, {
        point: pointOf(event),
        background: handlersRef.current.isBackground(event.target),
      });
      remember();
    };

    const handleMove = (event: PointerEvent): void => {
      const touching = touches.get(event.pointerId);
      if (touching === undefined) return;
      const was = touching.point;
      touching.point = pointOf(event);

      const pinch = pinchOf();
      if (pinch !== null) {
        const nextSpread = distance(pinch[0].point, pinch[1].point);
        const nextCentre = midpoint(pinch[0].point, pinch[1].point);
        if (spread > 0 && centre !== null) {
          const bounds = element.getBoundingClientRect();
          handlersRef.current.onPinch(
            { x: nextCentre.x - bounds.left, y: nextCentre.y - bounds.top },
            nextSpread / spread,
            { x: nextCentre.x - centre.x, y: nextCentre.y - centre.y },
          );
        }
        spread = nextSpread;
        centre = nextCentre;
        return;
      }

      if (!touching.background) return;
      handlersRef.current.onPan({ x: touching.point.x - was.x, y: touching.point.y - was.y });
    };

    const handleUp = (event: PointerEvent): void => {
      if (!touches.delete(event.pointerId)) return;
      remember();
    };

    element.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      element.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [ref]);
}
