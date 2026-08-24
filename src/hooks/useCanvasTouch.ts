import { useEffect, useRef, type RefObject } from 'react';
import type { Point } from '../model/geometry';
import { createTouchGesture } from '../model/touchGesture';

export interface CanvasTouchHandlers {
  /** True when the press landed on the board itself rather than on a note. */
  isBackground: (target: EventTarget | null) => boolean;
  onPan: (by: Point) => void;
  onPinch: (pivot: Point, factor: number, by: Point) => void;
}

/**
 * Touch has no middle button and no modifier keys, so the board reads fingers instead. What
 * they add up to is worked out by the tracker; this only wires it to the element and turns
 * the pinch centre into somewhere on the board.
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

    const gesture = createTouchGesture();

    const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

    const handleDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') return;
      gesture.down(
        event.pointerId,
        pointOf(event),
        handlersRef.current.isBackground(event.target),
        event.isPrimary,
      );
    };

    const handleMove = (event: PointerEvent): void => {
      const action = gesture.move(event.pointerId, pointOf(event));
      if (action.kind === 'pan') {
        handlersRef.current.onPan(action.by);
        return;
      }
      if (action.kind === 'pinch') {
        const bounds = element.getBoundingClientRect();
        handlersRef.current.onPinch(
          { x: action.centre.x - bounds.left, y: action.centre.y - bounds.top },
          action.factor,
          action.by,
        );
      }
    };

    const handleUp = (event: PointerEvent): void => gesture.up(event.pointerId);

    // Nothing is being pinched while the board is not on screen, and whatever the browser
    // does with the fingers in the meantime it will not tell us about.
    const handleAway = (): void => {
      if (document.visibilityState === 'hidden') gesture.clear();
    };

    element.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    window.addEventListener('blur', gesture.clear);
    document.addEventListener('visibilitychange', handleAway);
    return () => {
      element.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      window.removeEventListener('blur', gesture.clear);
      document.removeEventListener('visibilitychange', handleAway);
    };
  }, [ref]);
}
