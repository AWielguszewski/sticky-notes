import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { translate, type Point, type Rect } from '../model/geometry';
import { MIN_NOTE_SIZE, type Note, type NoteId } from '../model/note';
import { deltaToWorld, type Viewport } from '../model/viewport';
import { effectiveColor, type TagMap } from '../state/notesReducer';
import { useNoteActions } from '../state/useNotes';
import { ColorPicker } from './ColorPicker';
import { NoteImages } from './NoteImages';
import { NoteTags } from './NoteTags';
import styles from './NoteCard.module.css';

export interface NoteDropTarget {
  begin(): void;
  update(point: Point): boolean;
  drop(point: Point): boolean;
  cancel(): void;
}

/** What the board knows and a single note does not: who else is picked, and where they are. */
export interface NoteGroup {
  register(id: NoteId, element: HTMLElement | null): void;
  /** The note itself, or the whole selection when it belongs to one. */
  members(id: NoteId): NoteId[];
  rectOf(id: NoteId): Rect | null;
  elementOf(id: NoteId): HTMLElement | null;
}

interface NoteCardProps {
  note: Note;
  tags: TagMap;
  selected: boolean;
  startEditing: boolean;
  getViewport: () => Viewport;
  dropTarget: NoteDropTarget;
  group: NoteGroup;
}

/** Geometry captured when a gesture starts; the pointer delta is applied to it on every frame. */
interface GestureContext {
  rect: Rect;
  viewport: Viewport;
}

interface Travelling {
  id: NoteId;
  rect: Rect;
  element: HTMLElement;
}

interface MoveContext {
  members: Travelling[];
  viewport: Viewport;
}

type NoteFlag = 'dragging' | 'resizing' | 'doomed';

/** Pointer travel below this distance counts as a click on the note, not as a drag. */
const CLICK_SLOP_PX = 4;

const isDrag = (delta: Point): boolean =>
  Math.abs(delta.x) > CLICK_SLOP_PX || Math.abs(delta.y) > CLICK_SLOP_PX;

const movedRect = ({ rect, viewport }: GestureContext, delta: Point): Rect => ({
  ...rect,
  ...translate(rect, deltaToWorld(viewport, delta)),
});

const writeRect = (element: HTMLElement, rect: Rect): void => {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
};

const flagAll = (members: Travelling[], flag: NoteFlag, on: boolean): void => {
  for (const member of members) member.element.toggleAttribute(`data-${flag}`, on);
};

const resizedRect = ({ rect, viewport }: GestureContext, delta: Point): Rect => {
  const by = deltaToWorld(viewport, delta);
  return {
    ...rect,
    width: Math.max(rect.width + by.x, MIN_NOTE_SIZE.width),
    height: Math.max(rect.height + by.y, MIN_NOTE_SIZE.height),
  };
};

const noteStyle = (note: Note): CSSProperties => ({
  left: note.rect.x,
  top: note.rect.y,
  width: note.rect.width,
  height: note.rect.height,
  ['--note-z' as string]: note.z,
});

function NoteCardView({
  note,
  tags,
  selected,
  startEditing,
  getViewport,
  dropTarget,
  group,
}: NoteCardProps) {
  const actions = useNoteActions();
  const elementRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // While a note is not being edited its text layer ignores the pointer, so the whole
  // note can be grabbed; a click without travel hands the pointer back to the textarea.
  const [editing, setEditing] = useState(startEditing);

  const applyRect = useCallback((rect: Rect) => {
    if (elementRef.current !== null) writeRect(elementRef.current, rect);
  }, []);

  useEffect(() => {
    group.register(note.id, elementRef.current);
    return () => group.register(note.id, null);
  }, [group, note.id]);

  const setFlag = useCallback((flag: NoteFlag, on: boolean) => {
    elementRef.current?.toggleAttribute(`data-${flag}`, on);
  }, []);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  const handleMoveStart = usePointerDrag<MoveContext>({
    onStart: (event) => {
      if (event.button !== 0) return null;
      actions.raise(note.id);
      dropTarget.begin();

      const members: Travelling[] = [];
      for (const id of group.members(note.id)) {
        const rect = group.rectOf(id);
        const element = group.elementOf(id);
        if (rect !== null && element !== null) members.push({ id, rect, element });
      }
      flagAll(members, 'dragging', true);
      return { members, viewport: getViewport() };
    },
    onMove: ({ members, viewport }, { delta, point }) => {
      for (const member of members) {
        writeRect(member.element, movedRect({ rect: member.rect, viewport }, delta));
      }
      flagAll(members, 'doomed', dropTarget.update(point));
    },
    onEnd: ({ members, viewport }, { delta, point }) => {
      flagAll(members, 'dragging', false);
      flagAll(members, 'doomed', false);

      if (!isDrag(delta)) {
        dropTarget.cancel();
        setEditing(true);
        return;
      }
      const ids = members.map((member) => member.id);
      if (dropTarget.drop(point)) {
        actions.remove(ids);
        return;
      }
      for (const member of members) {
        writeRect(member.element, movedRect({ rect: member.rect, viewport }, delta));
      }
      actions.move(ids, deltaToWorld(viewport, delta));
    },
    onCancel: ({ members }) => {
      flagAll(members, 'dragging', false);
      flagAll(members, 'doomed', false);
      dropTarget.cancel();
      for (const member of members) writeRect(member.element, member.rect);
    },
  });

  const handleResizeStart = usePointerDrag<GestureContext>({
    onStart: (event) => {
      if (event.button !== 0) return null;
      actions.raise(note.id);
      setFlag('resizing', true);
      return { rect: note.rect, viewport: getViewport() };
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
      data-color={effectiveColor(note, tags)}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      aria-label="Sticky note"
      onPointerDown={handleMoveStart}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        const files = [...event.dataTransfer.files].filter((file) =>
          file.type.startsWith('image/'),
        );
        if (files.length === 0) return;
        event.preventDefault();
        for (const file of files) actions.attachImage(note.id, file);
      }}
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
        onPointerDown={(event) => {
          if (event.button === 0) event.stopPropagation();
        }}
        onPaste={(event) => {
          const files = [...event.clipboardData.files].filter((file) =>
            file.type.startsWith('image/'),
          );
          if (files.length === 0) return;
          event.preventDefault();
          for (const file of files) actions.attachImage(note.id, file);
        }}
        onFocus={() => actions.raise(note.id)}
        onBlur={() => setEditing(false)}
        onChange={(event) => actions.setText(note.id, event.target.value)}
      />

      <NoteImages noteId={note.id} images={note.images} />

      <NoteTags noteId={note.id} tagIds={note.tagIds} tags={tags} />

      <span
        className={styles.resizeHandle}
        title="Drag to resize"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          handleResizeStart(event);
        }}
      />
    </article>
  );
}

export const NoteCard = memo(NoteCardView);
