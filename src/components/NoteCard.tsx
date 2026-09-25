import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePointerDrag } from '../hooks/usePointerDrag';
import {
  clamp,
  clampRectInside,
  translate,
  type Point,
  type Rect,
  type Size,
} from '../model/geometry';
import { MIN_NOTE_SIZE, type Note } from '../model/note';
import { useNoteActions } from '../state/useNotes';
import { ColorPicker } from './ColorPicker';
import styles from './NoteCard.module.css';

export interface NoteDropTarget {
  begin(): void;
  update(point: Point): boolean;
  drop(point: Point): boolean;
  cancel(): void;
}

interface NoteCardProps {
  note: Note;
  selected: boolean;
  startEditing: boolean;
  getBoardSize: () => Size;
  dropTarget: NoteDropTarget;
}

/** Geometry captured when a gesture starts; the pointer delta is applied to it on every move. */
interface GestureContext {
  rect: Rect;
  board: Size;
}

type NoteFlag = 'dragging' | 'resizing' | 'doomed';

/** Pointer travel below this distance counts as a click on the note, not as a drag. */
const CLICK_SLOP_PX = 4;

const isDrag = (delta: Point): boolean =>
  Math.abs(delta.x) > CLICK_SLOP_PX || Math.abs(delta.y) > CLICK_SLOP_PX;

const movedRect = ({ rect, board }: GestureContext, delta: Point): Rect =>
  clampRectInside({ ...rect, ...translate(rect, delta) }, board);

const resizedRect = ({ rect, board }: GestureContext, delta: Point): Rect => ({
  ...rect,
  width: clamp(rect.width + delta.x, MIN_NOTE_SIZE.width, board.width - rect.x),
  height: clamp(rect.height + delta.y, MIN_NOTE_SIZE.height, board.height - rect.y),
});

/** A small tilt derived from the id, so a note keeps the same angle across reloads. */
const tiltOf = (id: string): string => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${((Math.abs(hash) % 5) - 2) * 0.5}deg`;
};

const noteStyle = (note: Note): CSSProperties => ({
  left: note.rect.x,
  top: note.rect.y,
  width: note.rect.width,
  height: note.rect.height,
  ['--note-z' as string]: note.z,
  ['--note-tilt' as string]: tiltOf(note.id),
});

function NoteCardView({ note, selected, startEditing, getBoardSize, dropTarget }: NoteCardProps) {
  const actions = useNoteActions();
  const elementRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // While a note is not being edited its text layer ignores the pointer, so the whole
  // note can be grabbed; a click without travel hands the pointer back to the textarea.
  const [editing, setEditing] = useState(startEditing);

  const applyRect = useCallback((rect: Rect) => {
    const element = elementRef.current;
    if (element === null) return;
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
  }, []);

  const setFlag = useCallback((flag: NoteFlag, on: boolean) => {
    elementRef.current?.toggleAttribute(`data-${flag}`, on);
  }, []);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  const handleMoveStart = usePointerDrag<GestureContext>({
    onStart: () => {
      actions.raise(note.id);
      dropTarget.begin();
      setFlag('dragging', true);
      return { rect: note.rect, board: getBoardSize() };
    },
    onMove: (context, { delta, point }) => {
      applyRect(movedRect(context, delta));
      setFlag('doomed', dropTarget.update(point));
    },
    onEnd: (context, { delta, point }) => {
      setFlag('dragging', false);
      setFlag('doomed', false);
      if (!isDrag(delta)) {
        dropTarget.cancel();
        setEditing(true);
        return;
      }
      if (dropTarget.drop(point)) {
        actions.remove(note.id);
        return;
      }
      const rect = movedRect(context, delta);
      applyRect(rect);
      actions.setGeometry(note.id, rect);
    },
    onCancel: (context) => {
      setFlag('dragging', false);
      setFlag('doomed', false);
      dropTarget.cancel();
      applyRect(context.rect);
    },
  });

  const handleResizeStart = usePointerDrag<GestureContext>({
    onStart: () => {
      actions.raise(note.id);
      setFlag('resizing', true);
      return { rect: note.rect, board: getBoardSize() };
    },
    onMove: (context, { delta }) => applyRect(resizedRect(context, delta)),
    onEnd: (context, { delta }) => {
      setFlag('resizing', false);
      const rect = resizedRect(context, delta);
      applyRect(rect);
      actions.setGeometry(note.id, rect);
    },
    onCancel: (context) => {
      setFlag('resizing', false);
      applyRect(context.rect);
    },
  });

  return (
    <article
      ref={elementRef}
      className={styles.note}
      style={noteStyle(note)}
      data-color={note.color}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      aria-label="Sticky note"
      onPointerDown={handleMoveStart}
    >
      <header className={styles.header}>
        <span className={styles.grip} aria-hidden="true" />
        <div className={styles.tools}>
          <ColorPicker
            value={note.color}
            label="Note color"
            onChange={(color) => actions.setColor(note.id, color)}
          />
        </div>
      </header>

      <textarea
        ref={textRef}
        className={styles.text}
        value={note.text}
        placeholder="Write something…"
        aria-label="Note text"
        spellCheck={false}
        onPointerDown={(event) => event.stopPropagation()}
        onFocus={() => actions.raise(note.id)}
        onBlur={() => setEditing(false)}
        onChange={(event) => actions.setText(note.id, event.target.value)}
      />

      <span
        className={styles.resizeHandle}
        title="Drag to resize"
        onPointerDown={(event) => {
          event.stopPropagation();
          handleResizeStart(event);
        }}
      />
    </article>
  );
}

export const NoteCard = memo(NoteCardView);
