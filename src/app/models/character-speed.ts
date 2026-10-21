export const SPEED_TYPES = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const;
export type SpeedType = typeof SPEED_TYPES[number];
export type SpeedValue = { kind: 'fixed'; feet: number } | { kind: 'walkingSpeed' };

interface SpeedState {
  id: string;
  condition?: string;
  /** Play-time override; removing it restores the authored value/reference. */
  overrideFeet?: number;
}

export type CharacterSpeed = SpeedState & (
  | { type: 'walk'; value: { kind: 'fixed'; feet: number } }
  | { type: 'fly'; value: SpeedValue; canHover?: boolean }
  | { type: 'swim' | 'climb' | 'burrow'; value: SpeedValue }
);

export function walkingSpeedEntry(feet = 30): CharacterSpeed {
  return { id: 'walk', type: 'walk', value: { kind: 'fixed', feet } };
}

/** A default must not reuse the ID of an existing conditional walking entry. */
export function defaultWalkingSpeed(speeds: readonly CharacterSpeed[]): CharacterSpeed {
  const entry = walkingSpeedEntry();
  for (let suffix = 1; speeds.some(speed => speed.id === entry.id); suffix++) entry.id = `walk-${suffix}`;
  return entry;
}

export function validateCharacterSpeeds(value: unknown): asserts value is CharacterSpeed[] {
  if (!Array.isArray(value)) throw new Error('Character speeds must be a list.');
  const ids = new Set<string>();
  const number = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid speed entry.');
    const speed = raw as Record<string, unknown>;
    const rate = speed['value'] as Record<string, unknown> | undefined;
    if (typeof speed['id'] !== 'string' || !speed['id'].trim() || ids.has(speed['id'])) throw new Error('Speed entries need unique IDs.');
    ids.add(speed['id']);
    if (!SPEED_TYPES.includes(speed['type'] as SpeedType)) throw new Error('Unknown speed type.');
    if (!rate || typeof rate !== 'object' || Array.isArray(rate)
      || (rate['kind'] === 'fixed' ? !number(rate['feet']) || Object.keys(rate).some(key => !['kind', 'feet'].includes(key))
        : rate['kind'] !== 'walkingSpeed' || speed['type'] === 'walk' || Object.keys(rate).some(key => key !== 'kind'))) throw new Error('Invalid speed value.');
    if (speed['condition'] !== undefined && typeof speed['condition'] !== 'string') throw new Error('Speed conditions must be text.');
    if (speed['overrideFeet'] !== undefined && !number(speed['overrideFeet'])) throw new Error('Speed overrides must be nonnegative whole numbers.');
    if (speed['canHover'] !== undefined && (speed['type'] !== 'fly' || typeof speed['canHover'] !== 'boolean')) throw new Error('Only flying speeds can have hover.');
    if (Object.keys(speed).some(key => !['id', 'type', 'value', 'condition', 'canHover', 'overrideFeet'].includes(key))) throw new Error('Unknown speed attribute.');
  }
}

/** Compatibility boundary only: convert historical numeric maps; new snapshots use the typed list. */
export function decodeCharacterSpeeds(value: unknown): CharacterSpeed[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) { validateCharacterSpeeds(value); return structuredClone(value); }
  if (typeof value !== 'object') throw new Error('Invalid legacy character speeds.');
  const entries = Object.entries(value).filter(([, feet]) => feet != null).map(([type, feet]) => ({
    id: type, type, value: { kind: 'fixed', feet },
  }));
  validateCharacterSpeeds(entries);
  return entries;
}

export function primaryWalkingSpeed(speeds: readonly CharacterSpeed[] | undefined): CharacterSpeed | undefined {
  return speeds?.find(speed => speed.type === 'walk' && !speed.condition);
}

export function walkingSpeedFeet(speeds: readonly CharacterSpeed[] | undefined): number {
  const walk = primaryWalkingSpeed(speeds);
  return walk?.overrideFeet ?? (walk?.value.kind === 'fixed' ? walk.value.feet : 30);
}

export function effectiveSpeedFeet(speed: CharacterSpeed, speeds: readonly CharacterSpeed[] | undefined): number {
  return speed.overrideFeet ?? (speed.value.kind === 'fixed' ? speed.value.feet : walkingSpeedFeet(speeds));
}

export function characterSpeedText(speed: CharacterSpeed, speeds: readonly CharacterSpeed[] | undefined): string {
  const value = speed.value.kind === 'walkingSpeed' && speed.overrideFeet == null
    ? `${effectiveSpeedFeet(speed, speeds)} ft. (equal to walking speed)` : `${effectiveSpeedFeet(speed, speeds)} ft.`;
  return `${speed.type.charAt(0).toUpperCase() + speed.type.slice(1)}: ${value}${speed.type === 'fly' && speed.canHover ? ' (hover)' : ''}${speed.condition ? ` — ${speed.condition}` : ''}`;
}
