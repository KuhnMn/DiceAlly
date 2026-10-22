import { ExportedCharacter, FeatureUses } from '../models/character.model';

/** Compare actual state changes so the report also works with repository-provided rest rules. */
export function summarizeRest(before: ExportedCharacter, after: ExportedCharacter): string[] {
  const changes: string[] = [];
  const restored = (label: string, previous = 0, current = 0) => {
    if (previous > current) changes.push(`${label}: ${previous - current} restored`);
  };
  const oldCharacter = before.character;
  const character = after.character;
  const healing = (character?.currentHp ?? 0) - (oldCharacter?.currentHp ?? 0);
  if (healing > 0) changes.push(`HP: ${healing} restored`);
  const tempLost = (oldCharacter?.tempHp ?? 0) - (character?.tempHp ?? 0);
  if (tempLost > 0) changes.push(`Temporary HP: ${tempLost} cleared`);
  if (Array.isArray(oldCharacter?.hitDice) && Array.isArray(character?.hitDice)) {
    oldCharacter.hitDice.forEach((die, index) => {
      const current = character.hitDice;
      if (Array.isArray(current)) restored(`Hit dice (${die.dieType})`, die.used, current[index]?.used);
    });
  }
  for (const [source, slots] of Object.entries(oldCharacter?.spellSlots ?? {})) {
    slots.forEach((slot, index) => restored(`${source}, level ${slot.level} slots`, slot.used,
      character?.spellSlots?.[source]?.[index]?.used));
  }
  const uses = (label: string, oldUses: FeatureUses[] = [], newUses: FeatureUses[] = []) => {
    oldUses.forEach((use, index) => restored(`${label}${use.tag ? ` (${use.tag})` : ''} uses`,
      use.usedFreeUses, newUses[index]?.usedFreeUses));
  };
  // Rest only changes counters; entries retain their order and identity.
  for (const category of ['features', 'spells', 'monsters', 'objects', 'inventory'] as const) {
    before[category]?.forEach((entry, index) => uses(entry.name || category, entry.uses,
      after[category]?.[index]?.uses));
  }
  if (before.species) uses(before.species.name || 'Species', before.species.uses, after.species?.uses);
  return changes;
}
