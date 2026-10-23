import { ContentRecord } from '../content/content.model';
import { SpeciesTrait, SPECIES_SENSES } from '../content/species.model';

const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export function speciesTraitText(trait: SpeciesTrait): string {
  if (trait.kind === 'fixed') return title(trait.value);
  if (trait.kind === 'choice') return `Choose ${trait.count}: ${trait.options.map(speciesTraitText).join(' / ')}`;
  return 'See description';
}

/** Only advertise traits present in this exact source/edition, never inferred from a species name. */
export function speciesBadges(record: ContentRecord): string[] {
  if (!['species', 'race', 'subrace'].includes(record.kind)) return [];
  const badges: string[] = [];
  for (const sense of SPECIES_SENSES) {
    const feet = record.species?.senses[sense] ?? record.data[sense];
    if (typeof feet === 'number' && feet > 0) badges.push(`${title(sense)} ${feet} ft.`);
  }
  const defenses = record.species?.defenses;
  if (defenses) {
    for (const [key, label] of [['resist', 'Resistance'], ['immune', 'Immunity'], ['vulnerable', 'Vulnerability'], ['conditionImmune', 'Condition Immunity']] as const) {
      for (const trait of defenses[key]) badges.push(`${speciesTraitText(trait)} · ${label}`);
    }
  }
  for (const trait of record.species?.creatureTypes ?? []) badges.push(speciesTraitText(trait));
  return badges;
}
