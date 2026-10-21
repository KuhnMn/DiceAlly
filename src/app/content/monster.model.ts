import type { BrewSourceByKind } from './generated/brew-source';

type SourceMonster = BrewSourceByKind['monster'];
/** Stat fields already used by the catalog and sheet; actions/entries retain their shared payloads. */
export interface MonsterDefinition extends Partial<Pick<SourceMonster,
  'size' | 'type' | 'alignment' | 'ac' | 'hp' | 'speed' | 'initiative'
  | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'senses'
  | 'passive' | 'languages' | 'cr' | 'vulnerable' | 'resist' | 'immune' | 'conditionImmune'>> {
  version: 1;
}
