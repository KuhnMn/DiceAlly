import { ContentRecord, JsonObject } from '../content/content.model';
import { canonicalSpeciesRecord } from '../content/species-adapter';
import { MOVEMENT_MODES, SpeciesTrait, SPECIES_SENSES } from '../content/species.model';
import { ContentRulesIndex } from './feature-rules';
import { isCompleteSelection } from './spell-choice';
export interface SpeciesSelectionChoice { id: string; count: number; candidates: string[]; label: string; }
export type SpeciesField = 'speed' | 'resist' | 'immune' | 'vulnerable' | 'conditionImmune' | 'sense' | 'size' | 'creatureTypes';
export interface SpeciesContribution { field: SpeciesField; value: unknown; origin: string }
export interface SpeciesInstance {
  id: string;
  selectionId: string;
  sourceIdentity: string;
  revisionId: string;
  contentKey: string;
  snapshot: ContentRecord;
  customization: JsonObject;
}
/** A contribution ledger, not an equipment/conditional movement legality calculator. */
export function deriveSpecies(selection: { id: string; key: string } | undefined,index: ContentRulesIndex,
  manual: SpeciesContribution[] = [],previous?: SpeciesInstance, answers: Record<string, string[]> = {}) {
  const diagnostics: string[] = []; const generated: SpeciesContribution[] = [];
  const choices: SpeciesSelectionChoice[] = [];
  const warnings: string[] = [];
  let instance: SpeciesInstance | undefined;
  if (selection) {
    const record = index.records.get(selection.key);
    if (!selection.id || !index.sourceIdentity || !index.revisionId || !record || record.kind !== 'species') diagnostics.push('A valid materialized species selection and pinned context are required.');
    else if (previous && previous.contentKey === selection.key && (previous.sourceIdentity !== index.sourceIdentity || previous.revisionId !== index.revisionId)) diagnostics.push('Explicit species content-update preview is required.');
    else {
      let normalized: ContentRecord;
      try { normalized = canonicalSpeciesRecord(record, 'legacy'); }
      catch (error) { diagnostics.push(String(error)); return { canAccept: false, choices, diagnostics, warnings, instance: structuredClone(previous), manual: structuredClone(manual), generated: [], contributions: structuredClone(manual), removed: [] }; }
      instance = previous && previous.contentKey === selection.key && previous.selectionId === selection.id
        ? structuredClone(previous) : { id: JSON.stringify(['species-instance',index.sourceIdentity,selection.id,selection.key]),selectionId: selection.id,
          sourceIdentity: index.sourceIdentity,revisionId: index.revisionId,contentKey: selection.key,snapshot: normalized,customization: {} };
      instance.snapshot = normalized;
      const origin = instance.id;
      const data = normalized.species!;
      const select = (field: SpeciesField, options: string[], count: number, position: number, label: string) => {
        const id = JSON.stringify([field === 'resist' ? 'species-resistance' : `species-${field}`, selection.id, record.key, position]);
        const candidates = [...new Set(options)];
        if (!Number.isSafeInteger(count) || count < 1 || count > candidates.length) { diagnostics.push(`Invalid species ${label} choice.`); return []; }
        choices.push({ id, count, candidates, label });
        return isCompleteSelection(answers[id] ?? [], count, candidates) ? answers[id] : [];
      };
      const speed = data.movement;
      if (speed.kind === 'variable') warnings.push('Variable species movement requires a manual speed.');
      if (speed.kind === 'defined') {
        for (const mode of MOVEMENT_MODES) {
          const source = speed.modes[mode];
          const rate = source?.kind === 'walk-reference' ? speed.modes.walk : source;
          if (!source) continue;
          if (!rate || rate.kind !== 'fixed' || rate.feet < 0) { warnings.push(`${mode} movement requires a usable walking speed or manual value.`); continue; }
          generated.push({ field: 'speed', value: { mode, number: rate.feet, ...(rate.condition ? { condition: rate.condition } : {}) }, origin });
          if (rate.condition) warnings.push(`${mode} movement applies only ${rate.condition}; it is not added to unconditional speeds.`);
        }
        if (Object.keys(speed.alternatives).length) warnings.push('Alternative species speeds are preserved; select their active values manually.');
        if (speed.choice) for (const mode of select('speed', speed.choice.from, 1, 0, 'movement')) {
          generated.push({ field: 'speed', value: { mode, number: speed.choice.feet }, origin });
        }
      }
      const grant = (field: SpeciesField, values: SpeciesTrait[], label: string) => values.forEach((trait, position) => {
        if (trait.kind === 'fixed') generated.push({ field, value: trait.value, origin });
        else if (trait.kind === 'unavailable') diagnostics.push(trait.reason);
        else if (trait.options.some(option => option.kind !== 'fixed')) diagnostics.push(`Nested species ${label} choices require a handler.`);
        else for (const value of select(field, trait.options.filter(option => option.kind === 'fixed').map(option => option.value), trait.count, position, label)) generated.push({ field, value, origin });
      });
      const labels = { resist: 'resistance', immune: 'immunity', vulnerable: 'vulnerability', conditionImmune: 'condition immunity' };
      for (const field of ['resist','immune','vulnerable','conditionImmune'] as const) grant(field, data.defenses[field], labels[field]);
      grant('creatureTypes', data.creatureTypes, 'creature type');
      for (const value of data.sizes.length > 1 ? select('size', data.sizes, 1, 0, 'size') : data.sizes) generated.push({ field: 'size', value, origin });
      for (const sense of SPECIES_SENSES) {
        const range = data.senses[sense]; if (range === undefined) continue;
        if (typeof range !== 'number' || !Number.isFinite(range) || range < 0) { diagnostics.push(`Unsupported species sense: ${sense}`); continue; }
        generated.push({ field: 'sense',value: { sense,range },origin });
      }
    }
  }
  return { canAccept: diagnostics.length === 0 && choices.every(choice => isCompleteSelection(answers[choice.id] ?? [], choice.count, choice.candidates)),choices,diagnostics,warnings,instance: diagnostics.length ? structuredClone(previous) : instance,
    manual: structuredClone(manual),generated: diagnostics.length ? [] : generated,
    contributions: diagnostics.length ? structuredClone(manual) : [...structuredClone(manual),...generated],
    removed: diagnostics.length || !previous || previous.id === instance?.id ? [] : [structuredClone(previous)] };
}
