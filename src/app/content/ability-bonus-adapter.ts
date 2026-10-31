import { object } from './content.model';
import { SpeciesAbilityOption, SPECIES_ABILITIES } from './species.model';

export function adaptAbilityBonusOption(value: unknown): SpeciesAbilityOption {
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
