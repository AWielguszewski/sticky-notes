import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Rect } from '../model/geometry';
import type { NoteColor } from '../model/note';
import styles from './DraftNote.module.css';

export interface DraftNoteHandle {
  show(rect: Rect, color: NoteColor): void;
  hide(): void;
}

/** Outline drawn while a new note is being sized; it never takes part in a React render. */
export function DraftNote({ ref }: { ref: Ref<DraftNoteHandle> }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      show: (rect, color) => {
        const element = elementRef.current;
        if (element === null) return;
        element.dataset.color = color;
        element.style.left = `${rect.x}px`;
        element.style.top = `${rect.y}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        element.hidden = false;
        if (sizeRef.current !== null) {
          sizeRef.current.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
        }
      },
      hide: () => {
        if (elementRef.current !== null) elementRef.current.hidden = true;
      },
    }),
    [],
  );

  return (
    <div ref={elementRef} className={styles.draft} hidden aria-hidden="true">
      <span ref={sizeRef} className={styles.size} />
    </div>
  );
}
