import { ContentRecord, JsonObject, object } from '../content/content.model';
import { ContentRulesIndex } from './feature-rules';
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
  manual: SpeciesContribution[] = [],previous?: SpeciesInstance) {
  const diagnostics: string[] = []; const generated: SpeciesContribution[] = [];
  let instance: SpeciesInstance | undefined;
  if (selection) {
    const record = index.records.get(selection.key);
    if (!selection.id || !index.sourceIdentity || !index.revisionId || !record || record.kind !== 'species') diagnostics.push('A valid materialized species selection and pinned context are required.');
    else if (previous && previous.contentKey === selection.key && (previous.sourceIdentity !== index.sourceIdentity || previous.revisionId !== index.revisionId)) diagnostics.push('Explicit species content-update preview is required.');
    else {
      instance = previous && previous.contentKey === selection.key && previous.selectionId === selection.id
        ? structuredClone(previous) : { id: JSON.stringify(['species-instance',index.sourceIdentity,selection.id,selection.key]),selectionId: selection.id,
          sourceIdentity: index.sourceIdentity,revisionId: index.revisionId,contentKey: selection.key,snapshot: structuredClone(record),customization: {} };
      const origin = instance.id;
      const speed = object(record.data['speed']);
      if (record.data['speed'] !== undefined && !speed) diagnostics.push('Species speed requires a normalized movement handler.');
      if (speed) for (const [mode,value] of Object.entries(speed)) {
        const details = object(value);
        if (!['walk','fly','swim','climb','burrow'].includes(mode) || !details || typeof details['number'] !== 'number'
          || !Number.isFinite(details['number']) || details['number'] < 0) {
          diagnostics.push(`Unsupported species speed form: ${mode}`); continue;
        }
        generated.push({ field: 'speed',value: { mode,...structuredClone(details) },origin });
      }
      for (const field of ['resist','immune','vulnerable','conditionImmune','size','creatureTypes'] as const) {
        const value = record.data[field]; if (value === undefined) continue;
        if (!Array.isArray(value)) { diagnostics.push(`Unsupported species ${field} structure.`); continue; }
        for (const entry of value) generated.push({ field,value: structuredClone(entry),origin });
      }
      for (const sense of ['darkvision','blindsight','tremorsense','truesight']) {
        const range = record.data[sense]; if (range === undefined) continue;
        if (typeof range !== 'number' || !Number.isFinite(range) || range < 0) { diagnostics.push(`Unsupported species sense: ${sense}`); continue; }
        generated.push({ field: 'sense',value: { sense,range },origin });
      }
    }
  }
  return { canAccept: diagnostics.length === 0,diagnostics,instance: diagnostics.length ? structuredClone(previous) : instance,
    manual: structuredClone(manual),generated: diagnostics.length ? [] : generated,
    contributions: diagnostics.length ? structuredClone(manual) : [...structuredClone(manual),...generated],
    removed: diagnostics.length || !previous || previous.id === instance?.id ? [] : [structuredClone(previous)] };
}
