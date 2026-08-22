import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useCanvasTouch } from '../hooks/useCanvasTouch';
import { usePointerDrag } from '../hooks/usePointerDrag';
import {
  boundingRect,
  containsPoint,
  overlaps,
  rectFromCorners,
  type Point,
  type Rect,
} from '../model/geometry';
import { DEFAULT_NOTE_SIZE, type NoteColor, type NoteId } from '../model/note';
import { fitToRect, panBy, toWorld, zoomBy, zoomTo, type Viewport } from '../model/viewport';
import { selectVisibleNotes } from '../state/notesReducer';
import { useNoteActions, useNotesState } from '../state/useNotes';
import { viewportStore } from '../state/viewportStore';
import { Marquee, type MarqueeHandle } from './Marquee';
import { NoteCard, type NoteDropTarget, type NoteGroup } from './NoteCard';
import { TrashZone, type TrashZoneHandle } from './TrashZone';
import { ZoomControl } from './ZoomControl';
import styles from './Board.module.css';

/** Shorter drags count as a click on the board, which lets the selection go. */
const LASSO_THRESHOLD_PX = 6;

const GRID_STEP_PX = 26;

/** Below this the dot grid turns into noise, so it doubles instead of shrinking further. */
const MIN_GRID_PX = 16;

/** How long after the last camera change the board is left alone to redraw itself sharply. */
const CAMERA_SETTLE_MS = 200;

const WHEEL_LINE_PX = 16;

const ZOOM_SENSITIVITY = 320;

const ZOOM_STEP = 1.25;

const FIT_PADDING_PX = 80;

interface LassoGesture {
  kind: 'lasso';
  origin: Point;
  anchor: Point;
  keep: readonly NoteId[];
}

interface PanGesture {
  kind: 'pan';
  origin: Viewport;
}

type BoardGesture = LassoGesture | PanGesture;

const isLassoing = (delta: Point): boolean =>
  Math.abs(delta.x) >= LASSO_THRESHOLD_PX || Math.abs(delta.y) >= LASSO_THRESHOLD_PX;

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || target.isContentEditable);

const lassoedRect = ({ origin, anchor }: LassoGesture, point: Point): Rect =>
  rectFromCorners(
    anchor,
    toWorld(viewportStore.get(), { x: point.x - origin.x, y: point.y - origin.y }),
  );

export function Board({ draftColor }: { draftColor: NoteColor }) {
  const state = useNotesState();
  const actions = useNoteActions();
  const notes = selectVisibleNotes(state);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<MarqueeHandle>(null);
  const trashRef = useRef<TrashZoneHandle>(null);
  const createdIdRef = useRef<NoteId | null>(null);
  const panReadyRef = useRef(false);

  const getViewport = useCallback((): Viewport => viewportStore.get(), []);

  // A note drawn while a tag is filtered belongs to that tag.
  const filterTagId = state.filterTagId;
  const draftTagIds = useMemo(
    () => (filterTagId === null ? [] : [filterTagId]),
    [filterTagId],
  );

  const notesRef = useRef(notes);
  const selectionRef = useRef(state.selectedIds);
  useEffect(() => {
    notesRef.current = notes;
    selectionRef.current = state.selectedIds;
  });

  const selected = useMemo(() => new Set(state.selectedIds), [state.selectedIds]);

  // Notes register themselves here so a whole selection can be dragged as one.
  const group = useMemo<NoteGroup>(() => {
    const elements = new Map<NoteId, HTMLElement>();
    return {
      register: (id, element) => {
        if (element === null) elements.delete(id);
        else elements.set(id, element);
      },
      members: (id) => {
        const selection = selectionRef.current;
        return selection.length > 1 && selection.includes(id) ? [...selection] : [id];
      },
      rectOf: (id) => notesRef.current.find((note) => note.id === id)?.rect ?? null,
      elementOf: (id) => elements.get(id) ?? null,
    };
  }, []);

  const createNote = useCallback(
    (centre: Point) => {
      createdIdRef.current = actions.create(
        {
          x: centre.x - DEFAULT_NOTE_SIZE.width / 2,
          y: centre.y - DEFAULT_NOTE_SIZE.height / 2,
          ...DEFAULT_NOTE_SIZE,
        },
        draftColor,
        draftTagIds,
      );
    },
    [actions, draftColor, draftTagIds],
  );

  const zoomAtCentre = useCallback((factor: number) => {
    const element = viewportRef.current;
    if (element === null) return;
    const pivot = { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    viewportStore.set(zoomBy(viewportStore.get(), pivot, factor));
  }, []);

  const resetZoom = useCallback(() => {
    const element = viewportRef.current;
    if (element === null) return;
    const pivot = { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    viewportStore.set(zoomTo(viewportStore.get(), pivot, 1));
  }, []);

  const fitToNotes = useCallback(() => {
    const element = viewportRef.current;
    if (element === null) return;
    const bounds = boundingRect(notesRef.current.map((note) => note.rect));
    if (bounds === null) return;
    viewportStore.set(
      fitToRect(
        bounds,
        { width: element.clientWidth, height: element.clientHeight },
        FIT_PADDING_PX,
      ),
    );
  }, []);

  useCanvasTouch(viewportRef, {
    isBackground: (target) => target === viewportRef.current,
    onPan: (by) => viewportStore.set(panBy(viewportStore.get(), by)),
    onPinch: (pivot, factor, by) =>
      viewportStore.set(panBy(zoomBy(viewportStore.get(), pivot, factor), by)),
  });

  // The camera is written straight to the DOM: panning must not re-render a single note.
  useEffect(() => {
    const element = viewportRef.current;
    const world = worldRef.current;
    if (element === null || world === null) return;

    let settling: ReturnType<typeof setTimeout> | undefined;

    const apply = (): void => {
      const { x, y, scale } = viewportStore.get();
      world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      // Promoted to its own layer only while the camera is moving. A layer that stays
      // promoted keeps the raster it was given at the old zoom, and the notes go soft.
      world.style.willChange = 'transform';
      if (settling !== undefined) clearTimeout(settling);
      settling = setTimeout(() => {
        world.style.willChange = '';
      }, CAMERA_SETTLE_MS);

      let grid = GRID_STEP_PX * scale;
      while (grid < MIN_GRID_PX) grid *= 2;
      element.style.setProperty('--vp-x', `${x}`);
      element.style.setProperty('--vp-y', `${y}`);
      element.style.setProperty('--vp-scale', `${scale}`);
      element.style.setProperty('--vp-grid', `${grid}px`);
    };

    apply();
    const unsubscribe = viewportStore.subscribe(apply);
    return () => {
      if (settling !== undefined) clearTimeout(settling);
      unsubscribe();
    };
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey) {
        // A controlled textarea has no undo stack of its own, so the board owns the shortcut.
        if (event.code === 'KeyZ') {
          if (event.shiftKey) actions.redo();
          else actions.undo();
        } else if (event.code === 'KeyY') actions.redo();
        else if (isTyping(event.target)) return;
        else if (event.key === '0') resetZoom();
        else if (event.key === '+' || event.key === '=') zoomAtCentre(ZOOM_STEP);
        else if (event.key === '-') zoomAtCentre(1 / ZOOM_STEP);
        else return;
        event.preventDefault();
        return;
      }
      if (event.shiftKey && event.code === 'Digit1' && !isTyping(event.target)) {
        event.preventDefault();
        fitToNotes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, fitToNotes, resetZoom, zoomAtCentre]);

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
      // Fingers are read by useCanvasTouch instead: they drag the board and pinch it.
      if (event.pointerType === 'touch') return null;
      if (event.button !== 0 || event.target !== event.currentTarget) return null;

      const bounds = element.getBoundingClientRect();
      const origin = { x: bounds.left, y: bounds.top };
      return {
        kind: 'lasso',
        origin,
        // Holding shift keeps what was already picked and adds to it.
        keep: event.shiftKey ? selectionRef.current : [],
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
      if (isLassoing(delta)) {
        marqueeRef.current?.show(lassoedRect(context, point));
        return;
      }
      marqueeRef.current?.hide();
    },
    onEnd: (context, { point, delta }) => {
      if (context.kind === 'pan') {
        viewportRef.current?.toggleAttribute('data-panning', false);
        return;
      }
      marqueeRef.current?.hide();
      if (!isLassoing(delta)) {
        actions.select(context.keep);
        return;
      }

      const lassoed = lassoedRect(context, point);
      const caught = notesRef.current
        .filter((note) => overlaps(note.rect, lassoed))
        .map((note) => note.id);
      actions.select([...context.keep.filter((id) => !caught.includes(id)), ...caught]);
    },
    onCancel: (context) => {
      if (context.kind === 'pan') {
        viewportRef.current?.toggleAttribute('data-panning', false);
        viewportStore.set(context.origin);
        return;
      }
      marqueeRef.current?.hide();
    },
  });

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const element = viewportRef.current;
    if (element === null || event.target !== event.currentTarget) return;
    const bounds = element.getBoundingClientRect();
    createNote(
      toWorld(viewportStore.get(), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }),
    );
  };

  const createInMiddle = (): void => {
    const element = viewportRef.current;
    if (element === null) return;
    createNote(
      toWorld(viewportStore.get(), {
        x: element.clientWidth / 2,
        y: element.clientHeight / 2,
      }),
    );
  };

  const selectedIds = state.selectedIds;
  useEffect(() => {
    if (selectedIds.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.key === 'Escape') {
        target?.blur();
        actions.select([]);
        return;
      }
      if (!isTyping(target) && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        actions.remove(selectedIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, selectedIds]);

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
            tags={state.tags}
            selected={selected.has(note.id)}
            startEditing={note.id === createdIdRef.current}
            getViewport={getViewport}
            dropTarget={dropTarget}
            group={group}
          />
        ))}

        <Marquee ref={marqueeRef} />
      </div>

      <button type="button" className={styles.newNote} title="New note" onClick={createInMiddle}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New note
      </button>

      <TrashZone ref={trashRef} />
      <ZoomControl
        onZoomIn={() => zoomAtCentre(ZOOM_STEP)}
        onZoomOut={() => zoomAtCentre(1 / ZOOM_STEP)}
        onReset={resetZoom}
        onFit={fitToNotes}
      />

      {state.status === 'loading' && <p className={styles.placeholder}>Loading notes…</p>}
      {state.status === 'failed' && <p className={styles.placeholder}>Notes could not be loaded.</p>}
      {state.status === 'ready' && notes.length === 0 && (
        <p className={styles.placeholder}>
          {state.filterTagId === null
            ? 'Double-click anywhere for a note · drag to lasso · scroll to pan · Ctrl+scroll to zoom'
            : 'No notes carry this tag yet · double-click to make one'}
        </p>
      )}
    </div>
  );
}
