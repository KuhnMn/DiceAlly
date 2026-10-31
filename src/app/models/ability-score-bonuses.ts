import type { AbilityScores, ExportedCharacter, FeatureEntryFull, Background } from './character.model';
import type { SpeciesAbility, SpeciesAbilityOption } from '../content/species.model';
import { adaptAbilityBonusOption } from '../content/ability-bonus-adapter';

export const BONUS_ABILITIES = [
  { key: 'str', field: 'strength', label: 'Strength' }, { key: 'dex', field: 'dexterity', label: 'Dexterity' },
  { key: 'con', field: 'constitution', label: 'Constitution' }, { key: 'int', field: 'intelligence', label: 'Intelligence' },
  { key: 'wis', field: 'wisdom', label: 'Wisdom' }, { key: 'cha', field: 'charisma', label: 'Charisma' },
] as const;
export interface AbilityBonusSelection { optionIndex?: number; chosen?: SpeciesAbility[]; disabled?: boolean }
export interface AbilityBonusState {
  enabled: boolean;
  base: AbilityScores;
  choices: Record<string, AbilityBonusSelection>;
  custom: Record<string, SpeciesAbilityOption[]>;
}
export interface AbilityBonusSource {
  id: string; name: string; kind: 'Feature' | 'Feat' | 'Background' | 'Species';
  options: SpeciesAbilityOption[]; custom: boolean; hasContent?: boolean; error?: string;
}
export interface ResolvedAbilityBonus {
  source: AbilityBonusSource; selected?: SpeciesAbilityOption;
  bonuses: Partial<Record<SpeciesAbility, number>>; status: string; ready: boolean;
}
export function featureBonusSourceId(feature: FeatureEntryFull): string {
  return `feature:${feature.editorId ?? JSON.stringify([feature.contentReference?.key, feature.featureType, feature.name, feature.source, feature.featureSourceName])}`;
}
export function backgroundBonusSourceId(background: Background): string {
  return `background:${background.contentReference?.key ?? JSON.stringify([background.name, background.source])}`;
}
export function asiBonusOptions(): SpeciesAbilityOption[] {
  const from = BONUS_ABILITIES.map(ability => ability.key);
  return [
    { fixed: {}, hidden: false, maximum: 20, choice: { kind: 'uniform', from, count: 1, amount: 2 } },
    { fixed: {}, hidden: false, maximum: 20, choice: { kind: 'uniform', from, count: 2, amount: 1 } },
  ];
}

/** Species support is prepared for a later edition profile; current callers leave it disabled. */
export function abilityBonusSources(sheet: ExportedCharacter, includeSpecies = false): AbilityBonusSource[] {
  const sources: AbilityBonusSource[] = [];
  const add = (id: string, name: string, kind: AbilityBonusSource['kind'], raw: unknown, fallback: SpeciesAbilityOption[] = []) => {
    const custom = sheet.abilityBonuses?.custom?.[id];
    try {
      if (custom != null && !Array.isArray(custom)) throw new Error('Custom bonuses must be an array.');
      if (raw != null && !Array.isArray(raw)) throw new Error('Ability bonuses must be an array.');
      const options = custom ?? (raw == null ? fallback : (raw as unknown[]).map(adaptAbilityBonusOption));
      sources.push({ id, name, kind, options, custom: !!custom, hasContent: Array.isArray(raw) && raw.length > 0 || fallback.length > 0 });
    } catch (error) { sources.push({ id, name, kind, options: [], custom: !!custom, error: String(error) }); }
  };
  if (sheet.background) add(backgroundBonusSourceId(sheet.background), sheet.background.name, 'Background', sheet.background.entity?.['ability']);
  for (const feature of sheet.features ?? []) {
    const entity = feature.featEntity ?? feature.optionalFeatureEntity ?? feature.featureEntity;
    const isFeat = !!feature.featEntity || feature.featureType === 'FEAT';
    add(featureBonusSourceId(feature), feature.name, isFeat ? 'Feat' : 'Feature', entity?.ability);
  }
  if (includeSpecies && sheet.species) {
    const species = sheet.species;
    add(`species:${species.contentReference?.key ?? species.name}`, species.name ?? 'Species', 'Species', undefined, species.entity?.definition?.abilities ?? []);
  }
  return sources;
}

export function resolveAbilityBonus(source: AbilityBonusSource, selection: AbilityBonusSelection = {}): ResolvedAbilityBonus {
  const result: ResolvedAbilityBonus = { source, bonuses: {}, status: '', ready: false };
  if (selection.disabled === true) return { ...result, status: 'Not applied', ready: true };
  if (source.error) return { ...result, status: source.error };
  const optionIndex = selection.optionIndex ?? (source.options.length === 1 ? 0 : undefined);
  if (optionIndex === undefined) return { ...result, status: source.options.length ? 'Choose a bonus alternative' : 'No ability bonus configured' };
  const option = Number.isInteger(optionIndex) ? source.options[optionIndex] : undefined;
  if (!option) return { ...result, status: 'Choose a valid bonus alternative' };
  result.selected = option;
  const validAbility = (key: string): key is SpeciesAbility => BONUS_ABILITIES.some(ability => ability.key === key);
  const fail = (status: string) => ({ ...result, status, bonuses: {} });
  if (!option.fixed || typeof option.fixed !== 'object' || Array.isArray(option.fixed)) return fail('Invalid fixed ability bonuses');
  if (!Number.isSafeInteger(option.maximum) || option.maximum < 1 || option.maximum > 30) return fail('Unsupported ability score maximum');
  for (const [key, amount] of Object.entries(option.fixed)) {
    if (!validAbility(key) || !Number.isSafeInteger(amount) || Math.abs(amount!) > 30) return fail('Invalid fixed ability bonus');
  }
  const bonuses = { ...option.fixed };
  const choice = option.choice;
  if (choice?.kind === 'unavailable') return fail(choice.reason);
  if (choice) {
    if (!['uniform', 'weighted'].includes(choice.kind)) return fail('Unsupported ability bonus choice');
    if (choice.kind === 'weighted' && !Array.isArray(choice.weights)) return fail('Invalid weighted ability bonuses');
    const weights = choice.kind === 'weighted' ? choice.weights : Array.from({ length: Math.max(0, Math.min(6, choice.count)) }, () => choice.amount);
    const count = choice.kind === 'weighted' ? weights.length : choice.count;
    if (!Array.isArray(choice.from) || choice.from.some(key => !validAbility(key)) || new Set(choice.from).size !== choice.from.length
      || !Number.isSafeInteger(count) || count < 1 || count > choice.from.length || weights.length !== count
      || weights.some(amount => !Number.isSafeInteger(amount) || Math.abs(amount) > 30)
      || choice.kind === 'weighted' && choice.extensions && Object.keys(choice.extensions).length) return fail('Unsupported ability bonus choice');
    const chosen = selection.chosen ?? [];
    if (!Array.isArray(chosen) || chosen.length !== count || new Set(chosen).size !== count || chosen.some(key => !choice.from.includes(key))) return fail(`Choose ${count} distinct ${count === 1 ? 'ability' : 'abilities'}`);
    chosen.forEach((key, index) => bonuses[key] = (bonuses[key] ?? 0) + weights[index]);
  }
  return { ...result, bonuses, ready: true, status: 'Applied' };
}

/** Recompute from authored base values, never from previously calculated effective scores. */
export function calculateAbilityBonuses(sheet: ExportedCharacter, includeSpecies = false) {
  const state = sheet.abilityBonuses;
  const base = { ...(state?.enabled ? state.base : sheet.character?.abilityScores) };
  const effective = { ...base };
  const sources = state?.enabled ? abilityBonusSources(sheet, includeSpecies).filter(source => source.options.length || source.error)
    .map(source => resolveAbilityBonus(source, state.choices?.[source.id])) : [];
  const contributions: { sourceId: string; name: string; ability: SpeciesAbility; requested: number; applied: number }[] = [];
  for (const ability of BONUS_ABILITIES) {
    const starting = base[ability.field];
    if (typeof starting !== 'number' || !Number.isSafeInteger(starting)) continue;
    let value = starting;
    // Higher-cap bonuses follow ordinary bonuses so changing list order cannot alter the totals.
    const active = sources.filter(source => source.ready && source.bonuses[ability.key]).sort((a, b) => {
      const negative = (source: ResolvedAbilityBonus) => source.bonuses[ability.key]! < 0 ? -1 : source.selected!.maximum;
      return negative(a) - negative(b) || a.source.id.localeCompare(b.source.id);
    });
    for (const source of active) {
      const amount = source.bonuses[ability.key]!;
      const next = amount > 0 ? Math.max(value, Math.min(source.selected!.maximum, value + amount)) : Math.max(0, value + amount);
      contributions.push({ sourceId: source.source.id, name: source.source.name, ability: ability.key, requested: amount, applied: next - value });
      value = next;
    }
    effective[ability.field] = value;
  }
  return { base, effective, sources, contributions };
}
export function applyAbilityBonuses(sheet: ExportedCharacter): void {
  if (sheet.abilityBonuses?.enabled && sheet.character) sheet.character.abilityScores = calculateAbilityBonuses(sheet).effective;
}
export function setAbilityBonusesEnabled(sheet: ExportedCharacter, enabled: boolean): void {
  if (!sheet.character || !!sheet.abilityBonuses?.enabled === enabled) return;
  if (enabled) {
    for (const feature of sheet.features ?? []) feature.editorId ??= crypto.randomUUID();
    sheet.abilityBonuses = { ...sheet.abilityBonuses, enabled: true, base: { ...sheet.character.abilityScores },
      choices: sheet.abilityBonuses?.choices ?? {}, custom: sheet.abilityBonuses?.custom ?? {} };
    applyAbilityBonuses(sheet);
  } else {
    sheet.character.abilityScores = { ...sheet.abilityBonuses!.base };
    sheet.abilityBonuses!.enabled = false;
  }
}

export function abilityBonusOptionLabel(option: SpeciesAbilityOption): string {
  if (!option?.fixed || typeof option.fixed !== 'object') return 'Unsupported ability bonus';
  const fixed = Object.entries(option.fixed).map(([key, amount]) => `${amount! >= 0 ? '+' : ''}${amount} ${key.toUpperCase()}`);
  if (option.choice?.kind === 'uniform') fixed.push(`${option.choice.amount >= 0 ? '+' : ''}${option.choice.amount} to ${option.choice.count} ${option.choice.count === 1 ? 'ability' : 'abilities'}`);
  if (option.choice?.kind === 'weighted' && Array.isArray(option.choice.weights)) fixed.push(`${option.choice.weights.map(amount => `${amount >= 0 ? '+' : ''}${amount}`).join(' / ')} to distinct abilities`);
  if (option.choice?.kind === 'unavailable') fixed.push('Manual configuration needed');
  return `${fixed.join(' · ') || 'No increase'} · Max ${option.maximum}`;
}

/** Validate saved configuration, not the optional source metadata retained for manual inspection. */
export function validateAbilityBonusState(sheet: ExportedCharacter): void {
  const state = sheet.abilityBonuses;
  if (state === undefined) return;
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!record(state) || typeof state.enabled !== 'boolean' || !record(state.base) || !record(state.choices) || !record(state.custom)) throw new Error('Invalid ability bonus configuration.');
  for (const [key, value] of Object.entries(state.base)) {
    if (!BONUS_ABILITIES.some(ability => ability.field === key) || !Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid base ability score.');
  }
  for (const value of Object.values(state.choices)) {
    if (!record(value) || value['disabled'] !== undefined && typeof value['disabled'] !== 'boolean'
      || value['optionIndex'] !== undefined && (!Number.isSafeInteger(value['optionIndex']) || Number(value['optionIndex']) < 0)
      || value['chosen'] !== undefined && (!Array.isArray(value['chosen']) || value['chosen'].some(key => typeof key !== 'string'))) throw new Error('Invalid saved ability bonus choice.');
  }
  for (const options of Object.values(state.custom)) {
    if (!Array.isArray(options) || options.some(option => !record(option) || !record(option['fixed'])
      || option['choice'] !== undefined && !record(option['choice']))) throw new Error('Invalid custom ability bonuses.');
  }
}

/** Explain actual contributions, including score caps, using the same projection as the sheet. */
export function abilityScoreFormula(sheet: ExportedCharacter, field: keyof AbilityScores): string {
  const ability = BONUS_ABILITIES.find(entry => entry.field === field);
  const result = calculateAbilityBonuses(sheet);
  const base = result.base[field];
  if (!ability || base === undefined) return 'Score unavailable';
  const changes = result.contributions.filter(entry => entry.ability === ability.key);
  return `${base} Base${changes.map(entry => ` ${entry.applied >= 0 ? '+' : '−'} ${Math.abs(entry.applied)} ${entry.name}${entry.applied !== entry.requested ? ' (capped)' : ''}`).join('')} = ${result.effective[field]}`;
}
