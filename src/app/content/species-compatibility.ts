import type { SpeciesEntity } from '../models/character.model';
import { ContentRecord } from './content.model';
import { assertSpeciesDefinition, formatSpeciesMovement, speciesDefinition, unconditionalMovement } from './species-adapter';
import { SpeciesTrait } from './species.model';

/** One projection to the all-in-one Android-shaped sheet. Definition preserves richer mechanics. */
export function projectSpeciesEntity(record: ContentRecord): SpeciesEntity {
  const definition = speciesDefinition(record);
  const resistance = (trait: SpeciesTrait, nested = false): unknown => trait.kind === 'fixed'
    ? nested ? trait.value : { type: trait.value }
    : trait.kind === 'choice' ? { choose: { from: trait.options.map(value => resistance(value, true)), count: trait.count } }
    : structuredClone(trait.source);
  return { ...structuredClone(record.data), name: record.name, source: record.publication,
    definition: structuredClone(definition), speed: unconditionalMovement(definition),
    size: [...definition.sizes], creatureTypes: definition.creatureTypes.filter(trait => trait.kind === 'fixed').map(trait => trait.value),
    ...definition.senses,
    resist: definition.defenses.resist.map(trait => resistance(trait)),
  } as SpeciesEntity;
}

export function validateSpeciesEntity(entity: SpeciesEntity | null | undefined): void {
  if (entity?.definition !== undefined) assertSpeciesDefinition(entity.definition);
}

export function speciesMovementText(entity: SpeciesEntity | null | undefined): string {
  if (entity?.definition) return formatSpeciesMovement(entity.definition);
  return Object.entries(entity?.speed ?? {}).map(([mode, feet]) => `${mode} ${feet} ft.`).join(', ') || '—';
}

export function speciesTraitText(traits: SpeciesTrait[]): string {
  return traits.map(trait => trait.kind === 'fixed' ? trait.value : trait.kind === 'unavailable' ? trait.reason
    : `choose ${trait.count} of ${speciesTraitText(trait.options)}`).join(', ');
}
