import { SpeciesAbility as Ability, SPECIES_ABILITIES } from '../content/species.model';
import { speciesDefinition } from '../content/species-adapter';
import { abilityModifier } from './level-rules';
import { ContentRulesIndex } from './feature-rules';
export interface SpeciesAbilityChoice { optionIndex?: number; /** For weighted choices, order matches weights. */ chosen?: Ability[] }
export interface AbilityContribution { ability: Ability; amount: number; origin: string }
/** Validate manually entered scores without applying imported bonuses. */
export function manualAbilityScores(base: Record<Ability, number>) {
  const diagnostics: string[] = [];
  for (const ability of SPECIES_ABILITIES) {
    if (!Number.isSafeInteger(base[ability]) || base[ability] < 1 || base[ability] > 30)
      diagnostics.push('Invalid base ability: ' + ability);
  }
  return { canAccept: diagnostics.length === 0, diagnostics, choices: [],
    base: structuredClone(base), effective: structuredClone(base), contributions: [] as AbilityContribution[] };
}
/** Reserved pure helper; character calculations do not invoke species ability automation. */
export function deriveSpeciesAbilities(base: Record<Ability,number>, index: ContentRulesIndex,
  species: { id: string; key: string } | undefined, enabled: boolean, answer: SpeciesAbilityChoice = {}) {
  const diagnostics: string[] = []; const contributions: AbilityContribution[] = [];
  const effective = structuredClone(base);
  const choices: { optionCount: number; selectedOption?: number; candidates: Ability[]; count: number; amount: number; weights?: number[] }[] = [];
  for (const ability of SPECIES_ABILITIES) try { abilityModifier(base[ability]); } catch { diagnostics.push('Invalid base ability: ' + ability); }
  if (enabled && species) {
    const record = index.records.get(species.key);
    if (!species.id || !record || record.kind !== 'species') diagnostics.push('Missing materialized species ability source.');
    else try {
      const options = speciesDefinition(record).abilities;
      const selected = answer.optionIndex ?? (options.length === 1 ? 0 : undefined);
      if (options.length && (selected === undefined || !Number.isInteger(selected) || selected < 0 || selected >= options.length)) {
        diagnostics.push('Select a species ability alternative explicitly.');
        choices.push({ optionCount: options.length, candidates: [], count: 0, amount: 0 });
      } else if (options.length) {
        const option = options[selected!];
        const origin = JSON.stringify(['species-ability',index.sourceIdentity,species.id,species.key,selected]);
        const bonuses = { ...option.fixed };
        const choice = option.choice;
        if (choice?.kind === 'unavailable') diagnostics.push(choice.reason);
        else if (choice) {
          const weights = choice.kind === 'weighted' ? choice.weights : Array.from({ length: Math.max(0, Math.min(6, choice.count)) }, () => choice.amount);
          const count = choice.kind === 'weighted' ? weights.length : choice.count;
          choices.push({ optionCount: options.length, selectedOption: selected, candidates: [...choice.from], count,
            amount: choice.kind === 'uniform' ? choice.amount : 0, ...(choice.kind === 'weighted' ? { weights: [...weights] } : {}) });
          if (!Number.isSafeInteger(count) || count < 1 || count > choice.from.length || weights.some(n => !Number.isSafeInteger(n))) diagnostics.push('Invalid species ability allocation.');
          else if (choice.kind === 'weighted' && choice.extensions && Object.keys(choice.extensions).length) diagnostics.push('Weighted ability extensions require a rule handler.');
          else {
            const picked = answer.chosen ?? [];
            if (picked.length !== count || new Set(picked).size !== picked.length || picked.some(a => !choice.from.includes(a))) diagnostics.push('Choose ' + count + ' distinct eligible abilities.');
            else picked.forEach((ability, i) => bonuses[ability] = (bonuses[ability] ?? 0) + weights[i]);
          }
        }
        if (!Number.isSafeInteger(option.maximum) || option.maximum < 1 || option.maximum > 30) diagnostics.push('Unsupported species ability maximum.');
        for (const ability of SPECIES_ABILITIES) {
          const amount = bonuses[ability]; if (amount === undefined) continue;
          if (!Number.isSafeInteger(amount)) { diagnostics.push('Invalid species ability amount: ' + ability); continue; }
          effective[ability] = amount > 0 ? Math.max(base[ability], Math.min(option.maximum, base[ability] + amount)) : base[ability] + amount;
          contributions.push({ ability, amount: effective[ability] - base[ability], origin });
        }
      }
    } catch (error) { diagnostics.push(String(error)); }
  }
  for (const ability of SPECIES_ABILITIES) if (!Number.isSafeInteger(effective[ability]) || effective[ability] < 1 || effective[ability] > 30) diagnostics.push('Effective ' + ability + ' score is outside the supported range 1?30.');
  return { canAccept: diagnostics.length === 0, diagnostics, choices, base: structuredClone(base),
    effective: diagnostics.length ? structuredClone(base) : effective, contributions: diagnostics.length ? [] : contributions };
}
