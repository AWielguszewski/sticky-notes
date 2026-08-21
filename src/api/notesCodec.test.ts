import { describe, expect, it } from 'vitest';
import type { Note, NoteId } from '../model/note';
import { decodeNote, decodeNotes } from './notesCodec';

const note: Note = {
  id: 'a' as NoteId,
  rect: { x: 10, y: 20, width: 200, height: 200 },
  text: 'hey',
  color: 'lime',
  z: 3,
  tagIds: [],
  images: [],
};

describe('decodeNote', () => {
  it('accepts a sound note', () => {
    expect(decodeNote({ ...note })).toEqual(note);
  });

  it('rejects anything that is not a note', () => {
    expect(decodeNote(null)).toBeNull();
    expect(decodeNote('a note')).toBeNull();
    expect(decodeNote({ ...note, id: 7 })).toBeNull();
    expect(decodeNote({ ...note, color: 'chartreuse' })).toBeNull();
    expect(decodeNote({ ...note, z: null })).toBeNull();
    expect(decodeNote({ ...note, rect: { x: 0, y: 0, width: '200', height: 200 } })).toBeNull();
    expect(decodeNote({ ...note, rect: undefined })).toBeNull();
  });
});

describe('decodeNotes', () => {
  it('keeps the sound notes and drops the rest', () => {
    expect(decodeNotes([note, null, { ...note, color: 'chartreuse' }])).toEqual([note]);
  });

  it('has nothing to decode in a payload that is not a list', () => {
    expect(decodeNotes({ notes: [note] })).toEqual([]);
    expect(decodeNotes(undefined)).toEqual([]);
  });
});
