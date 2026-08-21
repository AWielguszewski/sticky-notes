import { beforeEach, describe, expect, it } from 'vitest';
import type { Note, NoteId } from '../model/note';
import { readNotes, writeNotes } from './notesStorage';

const STORAGE_KEY = 'sticky-notes.v1';

const note: Note = {
  id: 'a' as NoteId,
  rect: { x: 10, y: 20, width: 200, height: 200 },
  text: 'hey',
  color: 'lime',
  z: 3,
};

beforeEach(() => {
  localStorage.clear();
});

describe('readNotes', () => {
  it('reads back what was written', () => {
    writeNotes([note]);
    expect(readNotes()).toEqual([note]);
  });

  it('starts empty', () => {
    expect(readNotes()).toEqual([]);
  });

  it('survives broken json', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readNotes()).toEqual([]);
  });

  it('survives a payload that is not a list', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes: [note] }));
    expect(readNotes()).toEqual([]);
  });

  it('keeps the sound notes and drops the rest', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        note,
        null,
        { ...note, id: 7 },
        { ...note, color: 'chartreuse' },
        { ...note, rect: { x: 0, y: 0, width: '200', height: 200 } },
        { ...note, z: null },
      ]),
    );
    expect(readNotes()).toEqual([note]);
  });
});
