import { describe, expect, it } from 'vitest';
import type { Note, NoteId } from '../model/note';
import type { Tag, TagId } from '../model/tag';
import {
  effectiveColor,
  initialNotesState,
  notesReducer,
  selectNoteList,
  selectTagList,
  selectVisibleNotes,
  type NotesState,
} from './notesReducer';

const noteId = (value: string): NoteId => value as NoteId;

const tagId = (value: string): TagId => value as TagId;

const makeNote = (id: string, overrides: Partial<Note> = {}): Note => ({
  id: noteId(id),
  rect: { x: 0, y: 0, width: 200, height: 200 },
  text: '',
  color: 'amber',
  z: 1,
  tagIds: [],
  ...overrides,
});

const makeTag = (id: string, name: string, color: Tag['color'] = 'sky'): Tag => ({
  id: tagId(id),
  name,
  color,
});

const stateWith = (notes: Note[], tags: Tag[] = []): NotesState =>
  notesReducer(initialNotesState, { type: 'loaded', notes, tags });

describe('loading', () => {
  it('keys notes and tags by id and becomes ready', () => {
    const state = stateWith([makeNote('a'), makeNote('b')], [makeTag('t1', 'stkbot')]);
    expect(state.status).toBe('ready');
    expect(selectNoteList(state)).toHaveLength(2);
    expect(selectTagList(state)).toHaveLength(1);
  });

  it('remembers that loading failed', () => {
    expect(notesReducer(initialNotesState, { type: 'loadFailed' }).status).toBe('failed');
  });
});

describe('created', () => {
  it('puts the new note on top and selects it', () => {
    const state = notesReducer(stateWith([makeNote('a', { z: 7 })]), {
      type: 'created',
      id: noteId('b'),
      rect: { x: 10, y: 10, width: 140, height: 140 },
      color: 'sky',
      tagIds: [tagId('t1')],
    });
    expect(state.notes[noteId('b')]?.z).toBe(8);
    expect(state.notes[noteId('b')]?.tagIds).toEqual([tagId('t1')]);
    expect(state.selectedId).toBe(noteId('b'));
  });
});

describe('patching a note', () => {
  const state = stateWith([makeNote('a')]);

  it('applies text, colour, geometry and tags', () => {
    expect(
      notesReducer(state, { type: 'textChanged', id: noteId('a'), text: 'hi' }).notes[noteId('a')]
        ?.text,
    ).toBe('hi');
    expect(
      notesReducer(state, { type: 'colorChanged', id: noteId('a'), color: 'rose' }).notes[
        noteId('a')
      ]?.color,
    ).toBe('rose');
    const moved = { x: 40, y: 60, width: 300, height: 300 };
    expect(
      notesReducer(state, { type: 'geometryChanged', id: noteId('a'), rect: moved }).notes[
        noteId('a')
      ]?.rect,
    ).toEqual(moved);
    expect(
      notesReducer(state, { type: 'tagsChanged', id: noteId('a'), tagIds: [tagId('t1')] }).notes[
        noteId('a')
      ]?.tagIds,
    ).toEqual([tagId('t1')]);
  });

  it('ignores a note that is not there', () => {
    expect(notesReducer(state, { type: 'textChanged', id: noteId('ghost'), text: 'hi' })).toBe(
      state,
    );
  });
});

describe('raised', () => {
  const state = stateWith([makeNote('a', { z: 1 }), makeNote('b', { z: 2 })]);

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
    const selected = notesReducer(stateWith([makeNote('a')]), {
      type: 'selected',
      id: noteId('a'),
    });
    const state = notesReducer(selected, { type: 'removed', id: noteId('a') });
    expect(selectNoteList(state)).toHaveLength(0);
    expect(state.selectedId).toBeNull();
  });
});

describe('tags', () => {
  const tagged = stateWith(
    [makeNote('a', { tagIds: [tagId('t1')] }), makeNote('b')],
    [makeTag('t1', 'stkbot')],
  );

  it('adds and updates a tag', () => {
    const state = notesReducer(tagged, { type: 'tagSaved', tag: makeTag('t1', 'stkbot', 'rose') });
    expect(state.tags[tagId('t1')]?.color).toBe('rose');
  });

  it('takes a removed tag off the notes that carried it', () => {
    const state = notesReducer(tagged, { type: 'tagRemoved', id: tagId('t1') });
    expect(selectTagList(state)).toHaveLength(0);
    expect(state.notes[noteId('a')]?.tagIds).toEqual([]);
  });

  it('clears a filter that pointed at the removed tag', () => {
    const filtered = notesReducer(tagged, { type: 'filtered', tagId: tagId('t1') });
    expect(selectVisibleNotes(filtered)).toHaveLength(1);
    const state = notesReducer(filtered, { type: 'tagRemoved', id: tagId('t1') });
    expect(state.filterTagId).toBeNull();
    expect(selectVisibleNotes(state)).toHaveLength(2);
  });
});

describe('effectiveColor', () => {
  it('takes the colour of the first tag', () => {
    const state = stateWith(
      [makeNote('a', { color: 'amber', tagIds: [tagId('t1'), tagId('t2')] })],
      [makeTag('t1', 'stkbot', 'violet'), makeTag('t2', 'other', 'lime')],
    );
    const note = state.notes[noteId('a')];
    expect(note && effectiveColor(note, state.tags)).toBe('violet');
  });

  it('falls back to the colour of the note', () => {
    const state = stateWith([makeNote('a', { color: 'amber' })]);
    const note = state.notes[noteId('a')];
    expect(note && effectiveColor(note, state.tags)).toBe('amber');
  });

  it('skips a tag that is no longer there', () => {
    const state = stateWith(
      [makeNote('a', { color: 'amber', tagIds: [tagId('ghost'), tagId('t2')] })],
      [makeTag('t2', 'other', 'lime')],
    );
    const note = state.notes[noteId('a')];
    expect(note && effectiveColor(note, state.tags)).toBe('lime');
  });
});

describe('restored', () => {
  it('puts back the notes and tags it is given', () => {
    const before = stateWith([makeNote('a')], [makeTag('t1', 'stkbot')]);
    const after = notesReducer(before, { type: 'removed', id: noteId('a') });
    const undone = notesReducer(after, {
      type: 'restored',
      notes: before.notes,
      tags: before.tags,
    });
    expect(selectNoteList(undone)).toHaveLength(1);
  });

  it('lets go of a selection and a filter that no longer exist', () => {
    const full = stateWith([makeNote('a', { tagIds: [tagId('t1')] })], [makeTag('t1', 'stkbot')]);
    const selected = notesReducer(
      notesReducer(full, { type: 'selected', id: noteId('a') }),
      { type: 'filtered', tagId: tagId('t1') },
    );
    const state = notesReducer(selected, { type: 'restored', notes: {}, tags: {} });
    expect(state.selectedId).toBeNull();
    expect(state.filterTagId).toBeNull();
  });
});

describe('refreshed', () => {
  it('takes the server truth but keeps the notes still being written', () => {
    const local = stateWith([makeNote('a', { text: 'still typing' }), makeNote('b')]);
    const state = notesReducer(local, {
      type: 'refreshed',
      notes: [makeNote('a', { text: 'stale' }), makeNote('c')],
      tags: [],
      keep: [noteId('a')],
    });
    expect(state.notes[noteId('a')]?.text).toBe('still typing');
    expect(state.notes[noteId('b')]).toBeUndefined();
    expect(state.notes[noteId('c')]).toBeDefined();
  });
});
