import type { IndexedDbContentCache } from './content-cache';
import type { ContentRecord, ImportRevision } from './content.model';
import type { ExportedCharacter } from '../models/character.model';
import type { BasicActionDescription, BasicActionType } from '../models/character-references';

const ACTION_TYPES = { action: 'ACTION', bonus: 'BONUS', reaction: 'REACTION' } as const;
const SOURCE_PRIORITY = ['XPHB', 'XDMG'] as const;
export function isBasicActionSource(source: string): source is BasicActionDescription['source'] {
  return SOURCE_PRIORITY.some(allowed => allowed === source);
}
const sourceRank = (source: string) => {
  const index = SOURCE_PRIORITY.findIndex(allowed => allowed === source);
  return index < 0 ? SOURCE_PRIORITY.length : index;
};

/** Read canonical action timing only. Free/variable/unspecified timing belongs to Other. */
function snapshot(record: ContentRecord, revision: ImportRevision): BasicActionDescription | undefined {
  const definition = record.referenceDefinition;
  if (!isBasicActionSource(record.publication) || record.kind !== 'action' || definition?.kind !== 'action' || !definition.entries.length) return;
  const actionTypes = new Set<BasicActionType>();
  for (const time of definition.time ?? []) {
    actionTypes.add(typeof time === 'string' ? 'OTHER' : ACTION_TYPES[time.unit]);
  }
  if (!actionTypes.size) actionTypes.add('OTHER');
  return {
    name: record.name, source: record.publication, actionTypes: [...actionTypes],
    entries: structuredClone(definition.entries),
    contentReference: { key: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit },
  };
}

export type BasicActionCache = Pick<IndexedDbContentCache, 'get'> & Partial<Pick<IndexedDbContentCache, 'category'>>;

/** Keep saved references stable until explicit refresh, retaining missing/foreign definitions. */
export async function prepareBasicActionDescriptions(sheet: ExportedCharacter, cache: BasicActionCache, revision: ImportRevision, refresh: boolean): Promise<number> {
  const actions = structuredClone(sheet.basicActions?.filter(action => isBasicActionSource(action.source)) ?? []);
  if (sheet.basicActions !== undefined && actions.length === sheet.basicActions.length && !refresh) return 0;
  if (sheet.basicActions !== undefined) sheet.basicActions = actions;
  let updated = 0;
  if (refresh) {
    await Promise.all(actions.map(async (action, index) => {
      const reference = action.contentReference;
      if (!reference || reference.sourceIdentity !== revision.sourceIdentity) return;
      const record = await cache.get(revision.id, reference.key);
      const fresh = record && snapshot(record, revision);
      if (fresh) { actions[index] = fresh; updated++; }
    }));
  }
  if (cache.category) {
    // IndexedDB count=0 reads the whole category, without scanning the rest of the library.
    const records = await cache.category(revision.id, 'action', 0);
    records.sort((a, b) => sourceRank(a.publication) - sourceRank(b.publication) || a.key.localeCompare(b.key));
    const names = new Set(actions.map(action => action.name.toLowerCase()));
    for (const record of records) {
      if (names.has(record.name.toLowerCase())) continue;
      const action = snapshot(record, revision);
      if (!action) continue;
      actions.push(action); names.add(action.name.toLowerCase()); updated++;
    }
    // Do not mark a library without action definitions as populated; a later import can supply them.
    if (actions.length) sheet.basicActions = actions.sort((a, b) => a.name.localeCompare(b.name));
  } else if (updated) sheet.basicActions = actions;
  return updated;
}
