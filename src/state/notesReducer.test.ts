import { describe, expect, it } from 'vitest';
import type { Note, NoteId } from '../model/note';
import { initialNotesState, notesReducer, selectNoteList, type NotesState } from './notesReducer';

const noteId = (value: string): NoteId => value as NoteId;

const makeNote = (id: string, overrides: Partial<Note> = {}): Note => ({
  id: noteId(id),
  rect: { x: 0, y: 0, width: 200, height: 200 },
  text: '',
  color: 'amber',
  z: 1,
  ...overrides,
});

const stateWith = (...notes: Note[]): NotesState =>
  notesReducer(initialNotesState, { type: 'loaded', notes });

describe('loading', () => {
  it('keys the notes by id and becomes ready', () => {
    const state = stateWith(makeNote('a'), makeNote('b'));
    expect(state.status).toBe('ready');
    expect(selectNoteList(state)).toHaveLength(2);
  });

  it('remembers that loading failed', () => {
    expect(notesReducer(initialNotesState, { type: 'loadFailed' }).status).toBe('failed');
  });
});

describe('created', () => {
  it('puts the new note on top and selects it', () => {
    const state = notesReducer(stateWith(makeNote('a', { z: 7 })), {
      type: 'created',
      id: noteId('b'),
      rect: { x: 10, y: 10, width: 140, height: 140 },
      color: 'sky',
    });
    expect(state.notes[noteId('b')]?.z).toBe(8);
    expect(state.selectedId).toBe(noteId('b'));
  });
});

describe('patching a note', () => {
  const state = stateWith(makeNote('a'));

  it('applies text, colour and geometry', () => {
    expect(notesReducer(state, { type: 'textChanged', id: noteId('a'), text: 'hi' }).notes[
      noteId('a')
    ]?.text).toBe('hi');
    expect(notesReducer(state, { type: 'colorChanged', id: noteId('a'), color: 'rose' }).notes[
      noteId('a')
    ]?.color).toBe('rose');
    const moved = { x: 40, y: 60, width: 300, height: 300 };
    expect(notesReducer(state, { type: 'geometryChanged', id: noteId('a'), rect: moved }).notes[
      noteId('a')
    ]?.rect).toEqual(moved);
  });

  it('ignores a note that is not there', () => {
    expect(notesReducer(state, { type: 'textChanged', id: noteId('ghost'), text: 'hi' })).toBe(
      state,
    );
  });
});

describe('raised', () => {
  const state = stateWith(makeNote('a', { z: 1 }), makeNote('b', { z: 2 }));

  it('lifts a covered note above the rest', () => {
    const raised = notesReducer(state, { type: 'raised', id: noteId('a') });
    expect(raised.notes[noteId('a')]?.z).toBe(3);
    expect(raised.selectedId).toBe(noteId('a'));
  });

  it('only selects a note that is already on top', () => {
    const raised = notesReducer(state, { type: 'raised', id: noteId('b') });
    expect(raised.notes[noteId('b')]?.z).toBe(2);
    expect(raised.selectedId).toBe(noteId('b'));
  });
});

describe('removed', () => {
  it('drops the note and clears the selection', () => {
    const selected = notesReducer(stateWith(makeNote('a')), {
      type: 'selected',
      id: noteId('a'),
    });
    const state = notesReducer(selected, { type: 'removed', id: noteId('a') });
    expect(selectNoteList(state)).toHaveLength(0);
    expect(state.selectedId).toBeNull();
  });
});
