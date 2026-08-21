import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { containsPoint, rectFromCorners, type Point, type Rect } from '../model/geometry';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE, type NoteColor, type NoteId } from '../model/note';
import { panBy, toWorld, zoomBy, type Viewport } from '../model/viewport';
import { selectNoteList } from '../state/notesReducer';
import { useNoteActions, useNotesState } from '../state/useNotes';
import { viewportStore } from '../state/viewportStore';
import { DraftNote, type DraftNoteHandle } from './DraftNote';
import { NoteCard, type NoteDropTarget } from './NoteCard';
import { TrashZone, type TrashZoneHandle } from './TrashZone';
import styles from './Board.module.css';

/** Shorter drags are treated as a click on the board rather than as drawing a note. */
const DRAW_THRESHOLD_PX = 12;

const GRID_STEP_PX = 26;

/** Below this the dot grid turns into noise, so it doubles instead of shrinking further. */
const MIN_GRID_PX = 16;

const WHEEL_LINE_PX = 16;

const ZOOM_SENSITIVITY = 320;

interface DrawGesture {
  kind: 'draw';
  origin: Point;
  anchor: Point;
}

interface PanGesture {
  kind: 'pan';
  origin: Viewport;
}

type BoardGesture = DrawGesture | PanGesture;

const isDrawing = (delta: Point): boolean =>
  Math.abs(delta.x) >= DRAW_THRESHOLD_PX || Math.abs(delta.y) >= DRAW_THRESHOLD_PX;

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || target.isContentEditable);

const drawnRect = ({ origin, anchor }: DrawGesture, point: Point): Rect =>
  rectFromCorners(
    anchor,
    toWorld(viewportStore.get(), { x: point.x - origin.x, y: point.y - origin.y }),
  );

export function Board({ draftColor }: { draftColor: NoteColor }) {
  const state = useNotesState();
  const actions = useNoteActions();
  const notes = selectNoteList(state);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<DraftNoteHandle>(null);
  const trashRef = useRef<TrashZoneHandle>(null);
  const createdIdRef = useRef<NoteId | null>(null);
  const panReadyRef = useRef(false);

  const getViewport = useCallback((): Viewport => viewportStore.get(), []);

  // The camera is written straight to the DOM: panning must not re-render a single note.
  useEffect(() => {
    const element = viewportRef.current;
    const world = worldRef.current;
    if (element === null || world === null) return;

    const apply = (): void => {
      const { x, y, scale } = viewportStore.get();
      world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      let grid = GRID_STEP_PX * scale;
      while (grid < MIN_GRID_PX) grid *= 2;
      element.style.setProperty('--vp-x', `${x}`);
      element.style.setProperty('--vp-y', `${y}`);
      element.style.setProperty('--vp-scale', `${scale}`);
      element.style.setProperty('--vp-grid', `${grid}px`);
    };

    apply();
    return viewportStore.subscribe(apply);
  }, []);

  // Wheel has to be non-passive to keep the browser from scrolling or zooming the page.
  useEffect(() => {
    const element = viewportRef.current;
    if (element === null) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const pivot = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const step = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
      // Trackpads report a pinch as a wheel event with the control key down.
      if (event.ctrlKey || event.metaKey) {
        viewportStore.set(
          zoomBy(viewportStore.get(), pivot, Math.exp((-event.deltaY * step) / ZOOM_SENSITIVITY)),
        );
        return;
      }
      viewportStore.set(
        panBy(viewportStore.get(), { x: -event.deltaX * step, y: -event.deltaY * step }),
      );
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (element === null) return;

    const setPanReady = (ready: boolean): void => {
      panReadyRef.current = ready;
      element.toggleAttribute('data-pan-ready', ready);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      setPanReady(true);
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setPanReady(false);
    };
    const handleBlur = (): void => setPanReady(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // The trash bounds are measured once per gesture, so dragging a note never forces a layout.
  const dropTarget = useMemo<NoteDropTarget>(() => {
    let zone: Rect | null = null;
    const isOver = (point: Point): boolean => zone !== null && containsPoint(zone, point);

    return {
      begin: () => {
        zone = trashRef.current?.measure() ?? null;
      },
      update: (point) => {
        const over = isOver(point);
        trashRef.current?.setActive(over);
        return over;
      },
      drop: (point) => {
        const over = isOver(point);
        trashRef.current?.setActive(false);
        zone = null;
        return over;
      },
      cancel: () => {
        trashRef.current?.setActive(false);
        zone = null;
      },
    };
  }, []);

  const handlePointerDown = usePointerDrag<BoardGesture>({
    onStart: (event) => {
      const element = viewportRef.current;
      if (element === null) return null;

      if (event.button === 1 || panReadyRef.current) {
        event.preventDefault();
        element.toggleAttribute('data-panning', true);
        return { kind: 'pan', origin: viewportStore.get() };
      }
      if (event.button !== 0 || event.target !== event.currentTarget) return null;

      actions.select(null);
      const bounds = element.getBoundingClientRect();
      const origin = { x: bounds.left, y: bounds.top };
      return {
        kind: 'draw',
        origin,
        anchor: toWorld(viewportStore.get(), {
          x: event.clientX - origin.x,
          y: event.clientY - origin.y,
        }),
      };
    },
    onMove: (context, { point, delta }) => {
      if (context.kind === 'pan') {
        viewportStore.set(panBy(context.origin, delta));
        return;
      }
      if (isDrawing(delta)) {
        draftRef.current?.show(drawnRect(context, point), draftColor);
        return;
      }
      draftRef.current?.hide();
    },
    onEnd: (context, { point, delta }) => {
      if (context.kind === 'pan') {
        viewportRef.current?.toggleAttribute('data-panning', false);
        return;
      }
      draftRef.current?.hide();
      if (!isDrawing(delta)) return;
      const drawn = drawnRect(context, point);
      createdIdRef.current = actions.create(
        {
          ...drawn,
          width: Math.max(drawn.width, MIN_NOTE_SIZE.width),
          height: Math.max(drawn.height, MIN_NOTE_SIZE.height),
        },
        draftColor,
      );
    },
    onCancel: (context) => {
      if (context.kind === 'pan') {
        viewportRef.current?.toggleAttribute('data-panning', false);
        viewportStore.set(context.origin);
        return;
      }
      draftRef.current?.hide();
    },
  });

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const element = viewportRef.current;
    if (element === null || event.target !== event.currentTarget) return;
    const bounds = element.getBoundingClientRect();
    const center = toWorld(viewportStore.get(), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    createdIdRef.current = actions.create(
      {
        x: center.x - DEFAULT_NOTE_SIZE.width / 2,
        y: center.y - DEFAULT_NOTE_SIZE.height / 2,
        ...DEFAULT_NOTE_SIZE,
      },
      draftColor,
    );
  };

  const selectedId = state.selectedId;
  useEffect(() => {
    if (selectedId === null) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.key === 'Escape') {
        target?.blur();
        actions.select(null);
        return;
      }
      if (!isTyping(target) && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        actions.remove(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, selectedId]);

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      <div ref={worldRef} className={styles.world}>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            selected={note.id === selectedId}
            startEditing={note.id === createdIdRef.current}
            getViewport={getViewport}
            dropTarget={dropTarget}
          />
        ))}

        <DraftNote ref={draftRef} />
      </div>

      <TrashZone ref={trashRef} />

      {state.status === 'loading' && <p className={styles.placeholder}>Loading notes…</p>}
      {state.status === 'failed' && <p className={styles.placeholder}>Notes could not be loaded.</p>}
      {state.status === 'ready' && notes.length === 0 && (
        <p className={styles.placeholder}>Drag anywhere to create a note</p>
      )}
    </div>
  );
}
