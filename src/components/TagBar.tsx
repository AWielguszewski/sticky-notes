import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import type { NoteColor } from '../model/note';
import { MAX_TAG_NAME_LENGTH, type Tag } from '../model/tag';
import { selectTagList } from '../state/notesReducer';
import { useNoteActions, useNotesState } from '../state/useNotes';
import { ColorPicker } from './ColorPicker';
import styles from './TagBar.module.css';

function TagRow({ tag }: { tag: Tag }) {
  const actions = useNoteActions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);

  const commit = (): void => {
    const input = inputRef.current;
    if (input === null || input.value.trim() === tag.name) return;
    if (!actions.renameTag(tag.id, input.value)) input.value = tag.name;
  };

  return (
    <div className={styles.row}>
      <ColorPicker
        value={tag.color}
        label={`Colour of ${tag.name}`}
        onChange={(color) => actions.setTagColor(tag.id, color)}
      />
      <input
        ref={inputRef}
        className={styles.name}
        defaultValue={tag.name}
        maxLength={MAX_TAG_NAME_LENGTH}
        aria-label={`Name of ${tag.name}`}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.currentTarget.value = tag.name;
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className={styles.delete}
        data-confirming={confirming || undefined}
        aria-label={`Delete ${tag.name}`}
        title="The notes stay, they go back to their own colour"
        onBlur={() => setConfirming(false)}
        onClick={() => {
          if (confirming) actions.removeTag(tag.id);
          else setConfirming(true);
        }}
      >
        {confirming ? 'Sure?' : '×'}
      </button>
    </div>
  );
}

function NewTagRow() {
  const actions = useNoteActions();
  const [name, setName] = useState('');
  const [color, setColor] = useState<NoteColor>('violet');
  const [taken, setTaken] = useState(false);

  const add = (): void => {
    if (name.trim() === '') return;
    if (actions.createTag(name, color) === null) {
      setTaken(true);
      return;
    }
    setName('');
    setTaken(false);
  };

  return (
    <div className={styles.row}>
      <ColorPicker value={color} label="Colour of the new tag" onChange={setColor} />
      <input
        className={styles.name}
        value={name}
        placeholder="New tag…"
        maxLength={MAX_TAG_NAME_LENGTH}
        aria-label="Name of the new tag"
        data-taken={taken || undefined}
        onChange={(event) => {
          setName(event.target.value);
          setTaken(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') add();
        }}
      />
      <button type="button" className={styles.add} aria-label="Add tag" onClick={add}>
        +
      </button>
    </div>
  );
}

export function TagBar() {
  const state = useNotesState();
  const actions = useNoteActions();
  const [open, setOpen] = useState(false);
  const managerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(managerRef, open, close);

  const tags = selectTagList(state);

  return (
    <div className={styles.bar}>
      <div className={styles.chips} data-filtering={state.filterTagId !== null || undefined}>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={styles.chip}
            data-color={tag.color}
            data-active={tag.id === state.filterTagId || undefined}
            aria-pressed={tag.id === state.filterTagId}
            title={tag.id === state.filterTagId ? 'Show every note' : `Show only ${tag.name}`}
            onClick={() =>
              actions.filterByTag(tag.id === state.filterTagId ? null : tag.id)
            }
          >
            {tag.name}
          </button>
        ))}
      </div>

      <div ref={managerRef} className={styles.manager}>
        <button
          type="button"
          className={styles.manage}
          aria-expanded={open}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          Tags
        </button>

        {open && (
          <div className={styles.panel}>
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
            <NewTagRow />
          </div>
        )}
      </div>
    </div>
  );
}
