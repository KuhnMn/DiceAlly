import { object } from '../content/content.model';
import { Ability } from './derived-stats';
import { abilityModifier } from './level-rules';
import { ContentRulesIndex } from './feature-rules';
export interface SpeciesAbilityChoice { optionIndex?: number; chosen?: Ability[] }
export interface AbilityContribution { ability: Ability; amount: number; origin: string }
const ABILITIES: Ability[] = ['str','dex','con','int','wis','cha'];
/** Base/manual scores are authoritative; automation is opt-in to avoid double-applying legacy bonuses. */
export function deriveSpeciesAbilities(base: Record<Ability,number>,index: ContentRulesIndex,
  species: { id: string; key: string } | undefined,enabled: boolean,answer: SpeciesAbilityChoice = {}) {
  const diagnostics: string[] = []; const contributions: AbilityContribution[] = [];
  const effective = structuredClone(base);
  const choices: { optionCount: number; selectedOption?: number; candidates: Ability[]; count: number; amount: number }[] = [];
  for (const ability of ABILITIES) try { abilityModifier(base[ability]); } catch { diagnostics.push(`Invalid base ability: ${ability}`); }
  if (enabled && species) {
    const record = index.records.get(species.key);
    if (!species.id || !record || record.kind !== 'species') diagnostics.push('Missing materialized species ability source.');
    else if (record.data['ability'] !== undefined) {
      const options = record.data['ability'];
      if (!Array.isArray(options)) diagnostics.push('Species ability alternatives require a handler.');
      else if (options.length) {
        const selected = answer.optionIndex ?? (options.length === 1 ? 0 : undefined);
        if (selected === undefined || !Number.isInteger(selected) || selected < 0 || selected >= options.length) {
          diagnostics.push('Select a species ability alternative explicitly.'); choices.push({ optionCount: options.length,candidates: [],count: 0,amount: 0 });
        } else {
          const data = object(options[selected]);
          const origin = JSON.stringify(['species-ability',index.sourceIdentity,species.id,species.key,selected]);
          if (!data) diagnostics.push('Invalid species ability alternative.');
          else for (const [field,value] of Object.entries(data)) {
            if (ABILITIES.includes(field as Ability)) {
              if (!Number.isSafeInteger(value) || Number(value) < -10 || Number(value) > 10) diagnostics.push(`Unsupported species ability amount: ${field}`);
              else contributions.push({ ability: field as Ability,amount: Number(value),origin });
            } else if (field === 'choose') {
              const choose = object(value); const from = choose?.['from']; const count = choose?.['count'] ?? 1; const amount = choose?.['amount'] ?? 1;
              if (!choose || Object.keys(choose).some(k => !['from','count','amount'].includes(k)) || !Array.isArray(from)
                || from.some(v => !ABILITIES.includes(v as Ability)) || new Set(from).size !== from.length
                || !Number.isSafeInteger(count) || Number(count) < 1 || Number(count) > from.length
                || !Number.isSafeInteger(amount) || Number(amount) < -10 || Number(amount) > 10) {
                diagnostics.push('Species ability choice handler required.'); continue;
              }
              choices.push({ optionCount: options.length,selectedOption: selected,candidates: [...from] as Ability[],count: Number(count),amount: Number(amount) });
              const picked = answer.chosen ?? [];
              if (picked.length !== count || new Set(picked).size !== picked.length || picked.some(a => !from.includes(a))) {
                diagnostics.push(`Choose ${count} distinct eligible abilities.`); continue;
              }
              picked.forEach(ability => contributions.push({ ability,amount: Number(amount),origin }));
            } else diagnostics.push(`Species ability handler required: ${field}`);
          }
        }
      }
    }
  }
  for (const contribution of contributions) effective[contribution.ability] += contribution.amount;
  for (const ability of ABILITIES) if (!Number.isSafeInteger(effective[ability]) || effective[ability] < 1 || effective[ability] > 30) diagnostics.push(`Effective ${ability} score is outside the supported range 1–30.`);
  return { canAccept: diagnostics.length === 0,diagnostics,choices,base: structuredClone(base),
    effective: diagnostics.length ? structuredClone(base) : effective,contributions: diagnostics.length ? [] : contributions };
}
