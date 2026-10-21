import type { Entry, EntriesHigherLevel } from '../models/character.model';

/** Android higher-level wrappers may omit a type; source entries also allow other entry kinds. */
export function higherLevelEntries(higher: Entry | EntriesHigherLevel): Entry[] {
  if (higher && typeof higher === 'object' && 'entries' in higher && Array.isArray(higher.entries)) return higher.entries;
  return [higher as Entry];
}
