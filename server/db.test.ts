import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type NoteInput, type NotesDatabase, type Tag } from './db.ts';

const note = (id: string, tagIds: string[] = []): NoteInput => ({
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
    expect(db.listNotes()).toEqual([{ ...note('n1'), images: [] }]);
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

describe('images', () => {
  it('hangs an image on a note and gives it back with the note', () => {
    db.saveNote(note('n1'));
    expect(db.addImage('n1', { id: 'i1', mime: 'image/png' })).toBe(true);
    expect(db.listNotes()[0]?.images).toEqual([{ id: 'i1', mime: 'image/png' }]);
  });

  it('keeps the order images were added in', () => {
    db.saveNote(note('n1'));
    db.addImage('n1', { id: 'i1', mime: 'image/png' });
    db.addImage('n1', { id: 'i2', mime: 'image/jpeg' });
    expect(db.listNotes()[0]?.images.map((image) => image.id)).toEqual(['i1', 'i2']);
  });

  it('refuses an image for a note that is not there', () => {
    expect(db.addImage('ghost', { id: 'i1', mime: 'image/png' })).toBe(false);
    expect(db.getImage('i1')).toBeNull();
  });

  it('names the images of a note, so their bytes can be swept up', () => {
    db.saveNote(note('n1'));
    db.saveNote(note('n2'));
    db.addImage('n1', { id: 'i1', mime: 'image/png' });
    db.addImage('n2', { id: 'i2', mime: 'image/png' });
    expect(db.imageIdsOf('n1')).toEqual(['i1']);
  });

  it('lets go of the images of a note it removes', () => {
    db.saveNote(note('n1'));
    db.addImage('n1', { id: 'i1', mime: 'image/png' });
    db.removeNote('n1');
    expect(db.getImage('i1')).toBeNull();
  });

  it('saving a note leaves its images where they are', () => {
    db.saveNote(note('n1'));
    db.addImage('n1', { id: 'i1', mime: 'image/png' });
    db.saveNote({ ...note('n1'), text: 'changed' });
    expect(db.listNotes()[0]?.images).toHaveLength(1);
  });

  it('removes one image on its own', () => {
    db.saveNote(note('n1'));
    db.addImage('n1', { id: 'i1', mime: 'image/png' });
    db.removeImage('i1');
    expect(db.listNotes()[0]?.images).toEqual([]);
  });
});
