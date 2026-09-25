import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Point } from '../model/geometry';

export interface DragUpdate {
  readonly start: Point;
  readonly point: Point;
  readonly delta: Point;
}

export interface PointerDragHandlers<TContext> {
  /** Returns the context shared by the rest of the gesture, or null to ignore the press. */
  onStart: (event: ReactPointerEvent<HTMLElement>) => TContext | null;
  onMove?: (context: TContext, update: DragUpdate) => void;
  onEnd?: (context: TContext, update: DragUpdate) => void;
  onCancel?: (context: TContext) => void;
}

interface DragSession<TContext> {
  context: TContext;
  element: HTMLElement;
  pointerId: number;
  start: Point;
  point: Point;
}

interface DragController {
  start(event: ReactPointerEvent<HTMLElement>): void;
  dispose(): void;
}

const toUpdate = <TContext>(session: DragSession<TContext>): DragUpdate => ({
  start: session.start,
  point: session.point,
  delta: { x: session.point.x - session.start.x, y: session.point.y - session.start.y },
});

const createDragController = <TContext>(
  handlers: RefObject<PointerDragHandlers<TContext>>,
): DragController => {
  let session: DragSession<TContext> | null = null;

  const stop = (): DragSession<TContext> | null => {
    const finished = session;
    session = null;
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
    window.removeEventListener('keydown', handleKeyDown);
    if (finished !== null && finished.element.hasPointerCapture(finished.pointerId)) {
      finished.element.releasePointerCapture(finished.pointerId);
    }
    return finished;
  };

  const cancel = (): void => {
    const cancelled = stop();
    if (cancelled !== null) handlers.current.onCancel?.(cancelled.context);
  };

  const handleMove = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== session.pointerId) return;
    session.point = { x: event.clientX, y: event.clientY };
    // Browsers already coalesce pointermove to about one event per frame, so no extra throttling.
    handlers.current.onMove?.(session.context, toUpdate(session));
  };

  const handleUp = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== session.pointerId) return;
    session.point = { x: event.clientX, y: event.clientY };
    const finished = stop();
    if (finished !== null) handlers.current.onEnd?.(finished.context, toUpdate(finished));
  };

  const handleCancel = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== session.pointerId) return;
    cancel();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') cancel();
  };

  return {
    start(event) {
      if (event.button !== 0 || session !== null) return;
      const context = handlers.current.onStart(event);
      if (context === null) return;

      const element = event.currentTarget;
      const start = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
      session = { context, element, pointerId: event.pointerId, start, point: start };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleCancel);
      window.addEventListener('keydown', handleKeyDown);
    },
    dispose: cancel,
  };
};

/**
 * Turns a pointer press into a drag gesture: the callbacks run outside React, so a gesture
 * can move or resize a DOM node directly and commit to the store only once, on release.
 */
export function usePointerDrag<TContext>(
  handlers: PointerDragHandlers<TContext>,
): (event: ReactPointerEvent<HTMLElement>) => void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const controllerRef = useRef<DragController | null>(null);
  controllerRef.current ??= createDragController(handlersRef);

  useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.dispose();
  }, []);

  return useCallback((event: ReactPointerEvent<HTMLElement>) => {
    controllerRef.current?.start(event);
  }, []);
}
