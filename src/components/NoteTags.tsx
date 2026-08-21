import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import type { NoteId } from '../model/note';
import type { Tag, TagId } from '../model/tag';
import type { TagMap } from '../state/notesReducer';
import { useNoteActions } from '../state/useNotes';
import styles from './NoteTags.module.css';

interface NoteTagsProps {
  noteId: NoteId;
  tagIds: readonly TagId[];
  tags: TagMap;
}

export function NoteTags({ noteId, tagIds, tags }: NoteTagsProps) {
  const actions = useNoteActions();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(menuRef, open, close);

  const all = Object.values(tags);
  const carried = tagIds
    .map((id) => tags[id])
    .filter((tag): tag is Tag => tag !== undefined);

  return (
    <div className={styles.tags} onPointerDown={(event) => event.stopPropagation()}>
      {carried.map((tag, index) => (
        <button
          key={tag.id}
          type="button"
          className={styles.chip}
          data-color={tag.color}
          data-primary={index === 0 || undefined}
          title={index === 0 ? `${tag.name} paints this note` : `Paint this note like ${tag.name}`}
          onClick={() => actions.makeTagPrimary(noteId, tag.id)}
        >
          {tag.name}
        </button>
      ))}

      <div ref={menuRef} className={styles.menu}>
        <button
          type="button"
          className={styles.add}
          aria-label="Tags of this note"
          aria-expanded={open}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          +
        </button>

        {open && (
          <div className={styles.panel}>
            {all.length === 0 ? (
              <p className={styles.empty}>No tags yet</p>
            ) : (
              all.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={styles.option}
                  data-checked={tagIds.includes(tag.id) || undefined}
                  onClick={() => actions.toggleTag(noteId, tag.id)}
                >
                  <span className={styles.dot} data-color={tag.color} />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
