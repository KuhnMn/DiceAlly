import { ContentRecord, ImportRevision, object } from '../content/content.model';
import { Monster, MonsterEntity } from '../models/character.model';
import { contentReference } from './editor-content-helpers';
import { newEditorId } from './editor-identity';

/** Embed the stat block so companions remain available without the installed content library. */
export function createMonsterEntry(record: ContentRecord, revision: ImportRevision): Monster {
  if (record.kind !== 'monster') throw new Error('Select a monster record.');
  const data = structuredClone(record.data);
  if (typeof data['type'] === 'string') data['type'] = { type: data['type'] };
  const speed = object(data['speed']);
  if (speed) data['speed'] = Object.fromEntries(Object.entries(speed).flatMap(([mode, value]) => {
    const number = typeof value === 'number' ? value : object(value)?.['number'];
    return typeof number === 'number' ? [[mode, number]] : [];
  }));
  return { editorId: newEditorId(), name: record.name, source: record.publication, userAdded: true,
    contentReference: contentReference(record, revision), entity: data as unknown as MonsterEntity,
    hpEnabled: false, notes: [], uses: [] };
}

/**
 * Maximum HP is an opt-in play tracker, independent of the original stat block.
 * Clearing it disables tracking; it never substitutes the stat block's average or formula.
 */
export function setMonsterMaxHp(monster: Monster, value: number | null | undefined): void {
  const previousMax = monster.monsterMaxHP;
  delete monster.monsterMaxHpOverride;
  if (value == null) {
    monster.hpEnabled = false;
    delete monster.monsterMaxHP;
    delete monster.monsterCurrentHP;
    delete monster.monsterTempHP;
    return;
  }
  monster.monsterMaxHP = value;
  monster.hpEnabled = true;
  if (monster.monsterCurrentHP == null || monster.monsterCurrentHP === previousMax) monster.monsterCurrentHP = value;
}
