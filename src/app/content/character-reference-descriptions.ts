import { ContentCache, IndexedDbContentCache } from './content-cache';
import { ImportRevision, entityKey } from './content.model';
import { activeContentRevision } from '../editor/active-content-revision';
import type { ExportedCharacter } from '../models/character.model';
import { CharacterReferenceDescriptions, SKILL_DEFINITIONS, STANDARD_CONDITIONS, STANDARD_SENSES, referenceDescription } from '../models/character-references';

const GROUPS = [
  { category: 'skills', kind: 'skill', names: SKILL_DEFINITIONS.map(skill => skill.name) },
  { category: 'senses', kind: 'sense', names: STANDARD_SENSES },
  { category: 'conditions', kind: 'condition', names: STANDARD_CONDITIONS.map(name => name.charAt(0) + name.slice(1).toLowerCase()) },
] as const;

/** Copy only description fields from canonical reference definitions, using exact identities. */
export async function prepareCharacterReferenceDescriptions(sheet: ExportedCharacter, cache: Pick<ContentCache, 'get'>, revision: ImportRevision, refresh = false): Promise<number> {
  const descriptions: CharacterReferenceDescriptions = structuredClone(sheet.referenceDescriptions ?? { skills: [], senses: [], conditions: [] });
  let updated = 0;
  await Promise.all(GROUPS.flatMap(group => group.names.map(async name => {
    const existing = referenceDescription(sheet, group.category, name);
    if (existing && !refresh) return;
    if (existing?.contentReference && existing.contentReference.sourceIdentity !== revision.sourceIdentity) return;
    for (const source of existing ? [existing.source] : ['XPHB', 'PHB', ...(group.kind === 'sense' ? ['MM'] : [])]) {
      const key = existing?.contentReference?.key ?? entityKey(group.kind, { name, source });
      const record = await cache.get(revision.id, key);
      if (!record || record.kind !== group.kind) continue;
      const definition = record.referenceDefinition;
      if (!definition || definition.kind !== group.kind || definition.version !== 1) continue;
      const entries = 'entries' in definition ? definition.entries : undefined;
      if (!entries?.length) continue;
      const list = descriptions[group.category];
      const snapshot = { name: record.name, source: record.publication, entries: structuredClone(entries), contentReference: {
        sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit, key: record.key,
      } };
      const index = existing ? list.findIndex(entry => entry.name === existing.name) : -1;
      if (index < 0) list.push(snapshot); else list[index] = snapshot;
      updated++; break;
    }
  })));
  if (updated) {
    for (const group of GROUPS) descriptions[group.category].sort((a, b) => a.name.localeCompare(b.name));
    sheet.referenceDescriptions = descriptions;
  }
  return updated;
}

/** Optional enrichment cannot make existing character saves depend on an installed library. */
export async function fillInstalledReferenceDescriptions(sheet: ExportedCharacter): Promise<void> {
  if (typeof indexedDB === 'undefined' || GROUPS.every(group => group.names.every(name => referenceDescription(sheet, group.category, name)))) return;
  try {
    const cache = new IndexedDbContentCache();
    const revision = await activeContentRevision(cache);
    if (revision) await prepareCharacterReferenceDescriptions(sheet, cache, revision);
  } catch { /* Missing/unavailable local content must not prevent opening or saving a character. */ }
}
