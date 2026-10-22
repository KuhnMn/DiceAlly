import type { ExportedCharacter } from '../models/character.model';
import type { SpellCastingStats } from '../content/spell-effects';
import type { CharacterHelpersService } from '../sheet/character-helpers.service';
import { sourceCombatStats } from './feature-source-stats';

/** Resolve the linked source exactly; select the highest configured attack and DC independently. */
export function spellCastingStats(sheet: ExportedCharacter | null | undefined, sourceName: string | null | undefined, helpers: CharacterHelpersService): SpellCastingStats | undefined {
  if (!sourceName || !sheet?.character) return;
  const source = sheet.character.featureSources?.find(source => source.name === sourceName);
  if (!source) return;
  return sourceCombatStats(source, sheet.character, helpers, 'spellcasting');
}
