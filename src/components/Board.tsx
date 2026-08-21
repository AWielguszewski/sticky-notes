import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { usePointerDrag } from '../hooks/usePointerDrag';
import {
  clampPoint,
  clampRectInside,
  containsPoint,
  rectFromCorners,
  type Point,
  type Rect,
  type Size,
} from '../model/geometry';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE, type NoteColor, type NoteId } from '../model/note';
import { selectNoteList } from '../state/notesReducer';
import { useNoteActions, useNotesState } from '../state/useNotes';
import { DraftNote, type DraftNoteHandle } from './DraftNote';
import { NoteCard, type NoteDropTarget } from './NoteCard';
import { TrashZone, type TrashZoneHandle } from './TrashZone';
import styles from './Board.module.css';

/** Shorter drags are treated as a click on the board rather than as drawing a note. */
const DRAW_THRESHOLD_PX = 12;

interface DrawContext {
  origin: Point;
  board: Size;
}

const isDrawing = (delta: Point): boolean =>
  Math.abs(delta.x) >= DRAW_THRESHOLD_PX || Math.abs(delta.y) >= DRAW_THRESHOLD_PX;

const measureBoard = (surface: HTMLElement): Size => ({
  width: surface.clientWidth,
  height: surface.clientHeight,
});

const drawnRect = ({ origin, board }: DrawContext, start: Point, point: Point): Rect =>
  rectFromCorners(
    clampPoint({ x: start.x - origin.x, y: start.y - origin.y }, board),
    clampPoint({ x: point.x - origin.x, y: point.y - origin.y }, board),
  );

export function Board({ draftColor }: { draftColor: NoteColor }) {
  const state = useNotesState();
  const actions = useNoteActions();
  const notes = selectNoteList(state);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<DraftNoteHandle>(null);
  const trashRef = useRef<TrashZoneHandle>(null);
  const createdIdRef = useRef<NoteId | null>(null);

  const getBoardSize = useCallback((): Size => {
    const surface = surfaceRef.current;
    return surface === null ? { width: 0, height: 0 } : measureBoard(surface);
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

  const handleDrawStart = usePointerDrag<DrawContext>({
    onStart: (event) => {
      const surface = surfaceRef.current;
      if (surface === null || event.target !== event.currentTarget) return null;
      actions.select(null);
      const bounds = surface.getBoundingClientRect();
      return { origin: { x: bounds.left, y: bounds.top }, board: measureBoard(surface) };
    },
    onMove: (context, { start, point, delta }) => {
      if (isDrawing(delta)) {
        draftRef.current?.show(drawnRect(context, start, point), draftColor);
        return;
      }
      draftRef.current?.hide();
    },
    onEnd: (context, { start, point, delta }) => {
      draftRef.current?.hide();
      if (!isDrawing(delta)) return;
      const drawn = drawnRect(context, start, point);
      const rect = clampRectInside(
        {
          ...drawn,
          width: Math.max(drawn.width, MIN_NOTE_SIZE.width),
          height: Math.max(drawn.height, MIN_NOTE_SIZE.height),
        },
        context.board,
      );
      createdIdRef.current = actions.create(rect, draftColor);
    },
    onCancel: () => draftRef.current?.hide(),
  });

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const surface = surfaceRef.current;
    if (surface === null || event.target !== event.currentTarget) return;
    const bounds = surface.getBoundingClientRect();
    const rect = clampRectInside(
      {
        x: event.clientX - bounds.left - DEFAULT_NOTE_SIZE.width / 2,
        y: event.clientY - bounds.top - DEFAULT_NOTE_SIZE.height / 2,
        ...DEFAULT_NOTE_SIZE,
      },
      measureBoard(surface),
    );
    createdIdRef.current = actions.create(rect, draftColor);
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
      const editing = target !== null && (target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        actions.remove(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, selectedId]);

  return (
    <div
      ref={surfaceRef}
      className={styles.surface}
      onPointerDown={handleDrawStart}
      onDoubleClick={handleDoubleClick}
    >
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          selected={note.id === selectedId}
          startEditing={note.id === createdIdRef.current}
          getBoardSize={getBoardSize}
          dropTarget={dropTarget}
        />
      ))}

      <DraftNote ref={draftRef} />
      <TrashZone ref={trashRef} />

      {state.status === 'loading' && <p className={styles.placeholder}>Loading notes…</p>}
      {state.status === 'failed' && <p className={styles.placeholder}>Notes could not be loaded.</p>}
      {state.status === 'ready' && notes.length === 0 && (
        <p className={styles.placeholder}>Drag anywhere to create a note</p>
      )}
    </div>
  );
}
