import { projectMonsterData } from '../content/monster-adapter';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { Monster, MonsterEntity } from '../models/character.model';
import { contentReference } from './editor-content-helpers';
import { newEditorId } from './editor-identity';

/** Embed the stat block so companions remain available without the installed content library. */
export function createMonsterEntry(record: ContentRecord, revision: ImportRevision): Monster {
  if (record.kind !== 'monster') throw new Error('Select a monster record.');
  const data = projectMonsterData(record);
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
