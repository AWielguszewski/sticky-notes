import type { Rect } from '../model/geometry';
import type { Note, NoteColor, NoteId } from '../model/note';
import type { TagId } from '../model/tag';

export type NotesStatus = 'loading' | 'ready' | 'failed';

export type NoteMap = Readonly<Record<NoteId, Note>>;

export interface NotesState {
  readonly status: NotesStatus;
  readonly notes: NoteMap;
  readonly selectedId: NoteId | null;
}

export type NotesAction =
  | { type: 'loaded'; notes: readonly Note[] }
  | { type: 'loadFailed' }
  | { type: 'created'; id: NoteId; rect: Rect; color: NoteColor; tagIds: readonly TagId[] }
  | { type: 'geometryChanged'; id: NoteId; rect: Rect }
  | { type: 'textChanged'; id: NoteId; text: string }
  | { type: 'colorChanged'; id: NoteId; color: NoteColor }
  | { type: 'raised'; id: NoteId }
  | { type: 'selected'; id: NoteId | null }
  | { type: 'removed'; id: NoteId };

export const initialNotesState: NotesState = {
  status: 'loading',
  notes: {},
  selectedId: null,
};

export const selectNoteList = (state: NotesState): Note[] => Object.values(state.notes);

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
      return { ...state, status: 'ready', notes };
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

    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
};
