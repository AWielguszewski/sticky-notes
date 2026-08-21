import type { Rect } from '../model/geometry';
import type { Note, NoteColor, NoteId } from '../model/note';
import type { Tag, TagId } from '../model/tag';

export type NotesStatus = 'loading' | 'ready' | 'failed';

export type NoteMap = Readonly<Record<NoteId, Note>>;

export type TagMap = Readonly<Record<TagId, Tag>>;

export interface NotesState {
  readonly status: NotesStatus;
  readonly notes: NoteMap;
  readonly tags: TagMap;
  readonly selectedId: NoteId | null;
  readonly filterTagId: TagId | null;
}

export type NotesAction =
  | { type: 'loaded'; notes: readonly Note[]; tags: readonly Tag[] }
  | { type: 'refreshed'; notes: readonly Note[]; tags: readonly Tag[]; keep: readonly NoteId[] }
  | { type: 'loadFailed' }
  | { type: 'created'; id: NoteId; rect: Rect; color: NoteColor; tagIds: readonly TagId[] }
  | { type: 'geometryChanged'; id: NoteId; rect: Rect }
  | { type: 'textChanged'; id: NoteId; text: string }
  | { type: 'colorChanged'; id: NoteId; color: NoteColor }
  | { type: 'tagsChanged'; id: NoteId; tagIds: readonly TagId[] }
  | { type: 'raised'; id: NoteId }
  | { type: 'selected'; id: NoteId | null }
  | { type: 'removed'; id: NoteId }
  | { type: 'tagSaved'; tag: Tag }
  | { type: 'tagRemoved'; id: TagId }
  | { type: 'filtered'; tagId: TagId | null };

export const initialNotesState: NotesState = {
  status: 'loading',
  notes: {},
  tags: {},
  selectedId: null,
  filterTagId: null,
};

export const selectNoteList = (state: NotesState): Note[] => Object.values(state.notes);

export const selectTagList = (state: NotesState): Tag[] => Object.values(state.tags);

/** What the board shows: everything, or only the notes carrying the filtered tag. */
export const selectVisibleNotes = (state: NotesState): Note[] => {
  const tagId = state.filterTagId;
  const notes = selectNoteList(state);
  return tagId === null ? notes : notes.filter((note) => note.tagIds.includes(tagId));
};

/** The first tag a note carries paints it; without one it keeps its own colour. */
export const effectiveColor = (note: Note, tags: TagMap): NoteColor => {
  for (const tagId of note.tagIds) {
    const tag = tags[tagId];
    if (tag !== undefined) return tag.color;
  }
  return note.color;
};

const topZ = (notes: NoteMap): number =>
  Object.values(notes).reduce((highest, note) => Math.max(highest, note.z), 0);

const patchNote = (state: NotesState, id: NoteId, patch: Partial<Note>): NotesState => {
  const note = state.notes[id];
  if (note === undefined) return state;
  return { ...state, notes: { ...state.notes, [id]: { ...note, ...patch } } };
};

export const notesReducer = (state: NotesState, action: NotesAction): NotesState => {
  switch (action.type) {
    case 'loaded': {
      const notes: Record<NoteId, Note> = {};
      for (const note of action.notes) notes[note.id] = note;
      const tags: Record<TagId, Tag> = {};
      for (const tag of action.tags) tags[tag.id] = tag;
      return { ...state, status: 'ready', notes, tags };
    }

    case 'refreshed': {
      const notes: Record<NoteId, Note> = {};
      for (const note of action.notes) notes[note.id] = note;
      // A note still waiting to be written must not be overwritten by what the server last saw.
      for (const id of action.keep) {
        const local = state.notes[id];
        if (local !== undefined) notes[id] = local;
      }
      const tags: Record<TagId, Tag> = {};
      for (const tag of action.tags) tags[tag.id] = tag;
      return { ...state, status: 'ready', notes, tags };
    }

    case 'loadFailed':
      return { ...state, status: 'failed' };

    case 'created': {
      const note: Note = {
        id: action.id,
        rect: action.rect,
        color: action.color,
        text: '',
        z: topZ(state.notes) + 1,
        tagIds: action.tagIds,
      };
      return { ...state, notes: { ...state.notes, [note.id]: note }, selectedId: note.id };
    }

    case 'geometryChanged':
      return patchNote(state, action.id, { rect: action.rect });

    case 'textChanged':
      return patchNote(state, action.id, { text: action.text });

    case 'colorChanged':
      return patchNote(state, action.id, { color: action.color });

    case 'tagsChanged':
      return patchNote(state, action.id, { tagIds: action.tagIds });

    case 'raised': {
      const note = state.notes[action.id];
      if (note === undefined) return state;
      const highest = topZ(state.notes);
      const raised =
        note.z === highest ? state : patchNote(state, action.id, { z: highest + 1 });
      return raised.selectedId === action.id ? raised : { ...raised, selectedId: action.id };
    }

    case 'selected':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };

    case 'removed': {
      const { [action.id]: removed, ...rest } = state.notes;
      if (removed === undefined) return state;
      return {
        ...state,
        notes: rest,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }

    case 'tagSaved':
      return { ...state, tags: { ...state.tags, [action.tag.id]: action.tag } };

    case 'tagRemoved': {
      const { [action.id]: removed, ...tags } = state.tags;
      if (removed === undefined) return state;

      // A tag that is gone must not linger on the notes that carried it.
      const notes: Record<NoteId, Note> = {};
      for (const note of Object.values(state.notes)) {
        notes[note.id] = note.tagIds.includes(action.id)
          ? { ...note, tagIds: note.tagIds.filter((tagId) => tagId !== action.id) }
          : note;
      }

      return {
        ...state,
        tags,
        notes,
        filterTagId: state.filterTagId === action.id ? null : state.filterTagId,
      };
    }

    case 'filtered':
      return state.filterTagId === action.tagId ? state : { ...state, filterTagId: action.tagId };

    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
};
