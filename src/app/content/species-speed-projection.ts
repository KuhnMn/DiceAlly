import { SpeciesDefinition, MovementRate } from './species.model';
import { CharacterSpeed, SpeedType } from '../models/character-speed';

/** Only declared structured movement is projected. Descriptions are never parsed. */
export function speciesSpeedEntries(definition: SpeciesDefinition): CharacterSpeed[] {
  const movement = definition.movement;
  if (movement.kind !== 'defined') return [];
  const entries: CharacterSpeed[] = [];
  const add = (type: SpeedType, rate: MovementRate, id: string) => {
    if (rate.kind === 'fixed' && rate.feet < 0 || type === 'walk' && rate.kind === 'walk-reference') return;
    const value = rate.kind === 'fixed' ? { kind: 'fixed' as const, feet: rate.feet } : { kind: 'walkingSpeed' as const };
    const common = { id, ...(rate.kind === 'fixed' && rate.condition ? { condition: rate.condition } : {}) };
    if (type === 'walk' && rate.kind === 'fixed') entries.push({ ...common, type, value: { kind: 'fixed', feet: rate.feet } });
    else if (type === 'fly') entries.push({ ...common, type, value, ...(movement.hover ? { canHover: true } : {}) });
    else if (type === 'walk') return;
    else entries.push({ ...common, type, value });
  };
  for (const type of ['walk', 'fly', 'swim', 'climb', 'burrow'] as const) {
    const rate = movement.modes[type];
    if (rate) add(type, rate, type === 'walk' && rate.kind === 'fixed' && rate.condition ? 'species:conditional-walk' : type);
    for (const [position, alternate] of (movement.alternatives[type] ?? []).entries()) add(type, alternate, `species:${type}:alternate:${position}`);
  }
  return entries;
}
