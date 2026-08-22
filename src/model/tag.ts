import { randomId } from './id';
import type { NoteColor } from './note';

export type TagId = string & { readonly __brand: 'TagId' };

export interface Tag {
  readonly id: TagId;
  readonly name: string;
  readonly color: NoteColor;
}

export const MAX_TAG_NAME_LENGTH = 32;

export const createTagId = (): TagId => randomId() as TagId;

export const normaliseTagName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_NAME_LENGTH);

export const sameTagName = (a: string, b: string): boolean =>
  a.toLocaleLowerCase() === b.toLocaleLowerCase();
