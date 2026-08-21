import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Note, type NotesDatabase, type Tag } from './db.ts';

const note = (id: string, tagIds: string[] = []): Note => ({
  id,
  rect: { x: 10, y: 20, width: 200, height: 180 },
  text: `note ${id}`,
  color: 'amber',
  z: 1,
  tagIds,
});

const tag = (id: string, name: string): Tag => ({ id, name, color: 'sky' });

let db: NotesDatabase;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('notes', () => {
  it('saves and reads back a note', () => {
    db.saveNote(note('n1'));
    expect(db.listNotes()).toEqual([note('n1')]);
  });

  it('updates a note that is already there', () => {
    db.saveNote(note('n1'));
    db.saveNote({ ...note('n1'), text: 'changed' });
    const notes = db.listNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toBe('changed');
  });

  it('removes a note', () => {
    db.saveNote(note('n1'));
    db.removeNote('n1');
    expect(db.listNotes()).toEqual([]);
  });
});

describe('tags', () => {
  it('links a note to its tags, in order', () => {
    db.saveTag(tag('t1', 'stkbot'));
    db.saveTag(tag('t2', 'marketrunner'));
    db.saveNote(note('n1', ['t2', 't1']));

    expect(db.listNotes()[0]?.tagIds).toEqual(['t2', 't1']);
  });

  it('ignores tags that do not exist', () => {
    db.saveNote(note('n1', ['ghost']));
    expect(db.listNotes()[0]?.tagIds).toEqual([]);
  });

  it('replaces the tags of a note on every save', () => {
    db.saveTag(tag('t1', 'stkbot'));
    db.saveTag(tag('t2', 'marketrunner'));
    db.saveNote(note('n1', ['t1', 't2']));
    db.saveNote(note('n1', ['t2']));

    expect(db.listNotes()[0]?.tagIds).toEqual(['t2']);
  });

  it('unlinks a deleted tag from its notes', () => {
    db.saveTag(tag('t1', 'stkbot'));
    db.saveNote(note('n1', ['t1']));
    db.removeTag('t1');

    expect(db.listTags()).toEqual([]);
    expect(db.listNotes()[0]?.tagIds).toEqual([]);
  });

  it('refuses a name another tag already goes by, whatever the case', () => {
    expect(db.saveTag(tag('t1', 'stkbot'))).toBe(true);
    expect(db.saveTag(tag('t2', 'STKBot'))).toBe(false);
    expect(db.listTags()).toHaveLength(1);
  });

  it('lets a tag keep its own name while changing colour', () => {
    db.saveTag(tag('t1', 'stkbot'));
    expect(db.saveTag({ id: 't1', name: 'stkbot', color: 'rose' })).toBe(true);
    expect(db.listTags()[0]?.color).toBe('rose');
  });

  it('drops the links of a deleted note', () => {
    db.saveTag(tag('t1', 'stkbot'));
    db.saveNote(note('n1', ['t1']));
    db.removeNote('n1');
    db.saveNote(note('n1'));

    expect(db.listNotes()[0]?.tagIds).toEqual([]);
  });
});
