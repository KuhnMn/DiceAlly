import { ContentRecord, JsonObject, object } from './content.model';
import { MovementMode, MovementRate, MOVEMENT_MODES, SpeciesAbilityOption, SpeciesDefinition,
  SpeciesMovement, SpeciesTrait, SPECIES_ABILITIES, SPECIES_SENSES } from './species.model';
import validateSpecies from './generated/species-validators.mjs';

const MECHANICAL_FIELDS = ['speed', 'ability', 'resist', 'immune', 'vulnerable', 'conditionImmune',
  'size', 'creatureTypes', ...SPECIES_SENSES];

export function assertSpeciesDefinition(value: unknown): asserts value is SpeciesDefinition {
  if (!validateSpecies(value)) {
    const error = validateSpecies.errors?.[0];
    throw new Error(`Invalid canonical species at ${error?.instancePath || '/'}: ${error?.message ?? 'unknown version or structure'}.`);
  }
}

function rate(value: unknown, legacy: boolean): MovementRate {
  if (value === true) return { kind: 'walk-reference' };
  if (typeof value === 'number') return { kind: 'fixed', feet: value };
  const details = object(value);
  if (!details || typeof details['number'] !== 'number'
      || (details['condition'] !== undefined && typeof details['condition'] !== 'string')
      || (!legacy && details['condition'] === undefined)
      || Object.keys(details).some(key => key !== 'number' && key !== 'condition')) throw new Error('Invalid source species movement rate.');
  return { kind: 'fixed', feet: details['number'],
    ...(details['condition'] === undefined ? {} : { condition: details['condition'] as string }) };
}

function movement(value: unknown, legacy: boolean): SpeciesMovement {
  if (value === undefined || value === null) return { kind: 'unspecified' };
  if (value === 'Varies') return { kind: 'variable' };
  const result: Extract<SpeciesMovement, { kind: 'defined' }> = { kind: 'defined', modes: {}, alternatives: {}, hover: false, hidden: [] };
  if (typeof value === 'number') { result.modes.walk = rate(value, legacy); return result; }
  const source = object(value);
  if (!source) throw new Error('Invalid source species movement.');
  if (Object.keys(source).some(key => ![...MOVEMENT_MODES, 'alternate', 'canHover', 'choose', 'hidden'].includes(key))) throw new Error('Unsupported historical species movement field.');
  for (const mode of MOVEMENT_MODES) {
    if (source[mode] !== undefined) result.modes[mode] = rate(source[mode], legacy);
    const alternate = object(source['alternate'])?.[mode];
    if (alternate !== undefined) {
      if (!Array.isArray(alternate)) throw new Error('Invalid alternate movement rates.');
      result.alternatives[mode] = alternate.map(value => rate(value, legacy));
    }
  }
  const extensions = Object.fromEntries(Object.entries(object(source['alternate']) ?? {}).filter(([key]) => !MOVEMENT_MODES.includes(key as MovementMode)));
  if (Object.keys(extensions).length) result.alternativeExtensions = structuredClone(extensions);
  const choose = object(source['choose']);
  if (choose) result.choice = { from: structuredClone(choose['from']) as MovementMode[], feet: choose['amount'] as number };
  result.hover = source['canHover'] === true;
  result.hidden = structuredClone(source['hidden'] ?? []) as MovementMode[];
  return result;
}

function abilityOption(value: unknown): SpeciesAbilityOption {
  const source = object(value);
  if (!source) throw new Error('Invalid species ability alternative.');
  if (Object.keys(source).some(key => ![...SPECIES_ABILITIES, 'choose', 'hidden', 'max'].includes(key))) throw new Error('Unsupported historical species ability field.');
  const result: SpeciesAbilityOption = { fixed: {}, hidden: source['hidden'] === true, maximum: (source['max'] === undefined ? 20 : source['max'] as number) };
  for (const ability of SPECIES_ABILITIES) if (source[ability] !== undefined) result.fixed[ability] = source[ability] as number;
  if (source['choose'] !== undefined) {
    const choose = object(source['choose']);
    if (!choose) throw new Error('Invalid species ability choice.');
    const entry = choose['entry'] === undefined ? {} : { entry: structuredClone(choose['entry']) };
    if (choose['weighted'] !== undefined) {
      const weighted = object(choose['weighted']);
      if (!Array.isArray(weighted?.['from']) || !Array.isArray(weighted?.['weights'])) {
        result.choice = { kind: 'unavailable', source: structuredClone(choose), reason: 'Weighted ability choice needs explicit candidates and weights.' };
      } else {
        const extensions = Object.fromEntries(Object.entries(weighted).filter(([key]) => key !== 'from' && key !== 'weights'));
        result.choice = { kind: 'weighted', from: structuredClone(weighted['from']), weights: structuredClone(weighted['weights']), ...entry,
          ...(Object.keys(extensions).length ? { extensions: structuredClone(extensions) } : {}) };
      }
    } else result.choice = { kind: 'uniform', from: structuredClone(choose['from']) as typeof SPECIES_ABILITIES[number][],
      count: (choose['count'] === undefined ? 1 : choose['count'] as number), amount: (choose['amount'] === undefined ? 1 : choose['amount'] as number), ...entry };
  }
  return result;
}

function traits(value: unknown, legacy: boolean): SpeciesTrait[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Species traits must be an array.');
  return value.map(value => {
    if (typeof value === 'string') return { kind: 'fixed', value };
    const source = object(value);
    if (!source) throw new Error('Invalid species trait.');
    if (legacy && typeof source['type'] === 'string' && Object.keys(source).length === 1) return { kind: 'fixed', value: source['type'] };
    const choose = source['choose'];
    if (Array.isArray(choose)) return { kind: 'choice', options: traits(choose, legacy), count: 1 };
    const choice = object(choose);
    if (choice) return { kind: 'choice', options: traits(choice['from'], legacy), count: (choice['count'] === undefined ? 1 : choice['count'] as number) };
    return { kind: 'unavailable', source: structuredClone(source), reason: 'Species trait has no declared value or choice.' };
  });
}

/** Boundary mapping: source and historical adapter-1..9 forms are explicit profiles. */
export function adaptSpecies(data: JsonObject, profile: 'source' | 'legacy' = 'source'): SpeciesDefinition {
  const legacy = profile === 'legacy';
  if (data['ability'] !== undefined && !Array.isArray(data['ability'])) throw new Error('Species ability alternatives must be an array.');
  const result: SpeciesDefinition = { version: 1, movement: movement(data['speed'], legacy),
    abilities: (data['ability'] as unknown[] | undefined ?? []).map(abilityOption),
    defenses: { resist: traits(data['resist'], legacy), immune: traits(data['immune'], legacy),
      vulnerable: traits(data['vulnerable'], legacy), conditionImmune: traits(data['conditionImmune'], legacy) },
    senses: {}, sizes: structuredClone(data['size'] ?? []) as string[], creatureTypes: traits(data['creatureTypes'], legacy) };
  for (const sense of SPECIES_SENSES) if (data[sense] !== undefined) result.senses[sense] = data[sense] as number;
  assertSpeciesDefinition(result);
  return result;
}

export function canonicalSpeciesRecord(record: ContentRecord, profile: 'source' | 'legacy' = 'source'): ContentRecord & { kind: 'species'; species: SpeciesDefinition } {
  if (record.kind !== 'species') throw new Error('Expected a playable species record.');
  if (record.species && MECHANICAL_FIELDS.some(field => Object.hasOwn(record.data, field))) {
    throw new Error('Canonical species contains duplicate legacy mechanical fields.');
  }
  const species = record.species ?? adaptSpecies(record.data, profile);
  assertSpeciesDefinition(species);
  const data = structuredClone(record.data);
  for (const field of MECHANICAL_FIELDS) delete data[field];
  return { ...record, kind: 'species', data, species: structuredClone(species) };
}

/** Historical compatibility is confined here; current consumers read typed fields. */
export function speciesDefinition(record: ContentRecord): SpeciesDefinition {
  if (record.kind !== 'species') throw new Error('Expected a playable species record.');
  if (record.species) { assertSpeciesDefinition(record.species); return record.species; }
  return canonicalSpeciesRecord(record, 'legacy').species;
}

export function unconditionalMovement(definition: SpeciesDefinition): Partial<Record<MovementMode, number>> {
  const movement = definition.movement;
  if (movement.kind !== 'defined') return {};
  const result: Partial<Record<MovementMode, number>> = {};
  for (const mode of MOVEMENT_MODES) {
    const rate = movement.modes[mode];
    const walk = movement.modes.walk;
    const fixed = rate?.kind === 'walk-reference' ? (walk?.kind === 'fixed' ? walk : undefined) : rate;
    if (fixed && !fixed.condition && fixed.feet >= 0) result[mode] = fixed.feet;
  }
  return result;
}

export function formatSpeciesMovement(definition: SpeciesDefinition): string {
  return formatMovement(definition.movement);
}

/** Objects and species share the same schema-native speed contract. */
export function formatSourceMovement(value: unknown): string {
  return formatMovement(movement(value, false));
}

function formatMovement(movement: SpeciesMovement): string {
  if (movement.kind === 'unspecified') return '—';
  if (movement.kind === 'variable') return 'Varies';
  const describe = (value: MovementRate) => value.kind === 'walk-reference' ? 'equal to walking speed'
    : `${value.feet} ft.${value.condition ? ` ${value.condition}` : ''}`;
  const parts = MOVEMENT_MODES.flatMap(mode => {
    const primary = movement.modes[mode];
    return [...(primary ? [`${mode} ${describe(primary)}`] : []), ...(movement.alternatives[mode] ?? []).map(value => `${mode} ${describe(value)} (alternative)`)];
  });
  if (movement.choice) parts.push(`choose ${movement.choice.from.join(' or ')} ${movement.choice.feet} ft.`);
  if (movement.hover) parts.push('can hover');
  return parts.join(', ') || '—';
}
