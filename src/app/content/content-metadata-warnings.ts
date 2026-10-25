import type { ErrorObject } from 'ajv';
import { ImportDiagnostic, object } from './content.model';

/** Reviewed descriptive indexes only. Rules, identifiers and rendering structures stay strict.
 * These optional arrays have string items, no maximum length, and no cross-field conditions.
 * Spell tag arrays additionally require unique values; monster indexes allow duplicates.
 */
const METADATA: Readonly<Record<string, Readonly<Record<string, { unique: boolean }>>>> = {
  spell: { miscTags: { unique: true }, areaTags: { unique: true } },
  monster: { environment: { unique: false }, traitTags: { unique: false }, actionTags: { unique: false },
    languageTags: { unique: false }, senseTags: { unique: false }, spellcastingTags: { unique: false }, damageTags: { unique: false } },
};

/** Validate a temporary projection; original metadata is retained for storage and future clients. */
export function metadataWarningCandidate(value: unknown, errors: readonly ErrorObject[], file: string): { value: unknown; diagnostics: ImportDiagnostic[] } | null {
  const root = object(value); if (!root) return null;
  for (const error of errors) {
    if (error.keyword !== 'enum') continue;
    const match = /^\/([^/]+)\/\d+\/([^/]+)\/\d+$/.exec(error.instancePath);
    if (!match) continue;
    const [, kind, field] = match, policy = METADATA[kind]?.[field];
    const allowed: unknown = error.params['allowedValues'];
    const records = root[kind];
    if (!policy || !Array.isArray(records) || !Array.isArray(allowed) || !allowed.every(item => typeof item === 'string')) continue;
    const known = new Set(allowed);
    const changes: { index: number; retained: string[] }[] = [], diagnostics: ImportDiagnostic[] = [];
    records.forEach((value, index) => {
      const record = object(value), tags = record?.[field];
      // Never hide malformed arrays or uniqueness errors behind a metadata warning.
      if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === 'string') || (policy.unique && new Set(tags).size !== tags.length)) return;
      const unknown = [...new Set(tags.filter(tag => !known.has(tag)))];
      if (!unknown.length) return;
      changes.push({ index, retained: tags.filter(tag => known.has(tag)) });
      diagnostics.push({ severity: 'warning', code: 'schema-metadata', phase: 'validate', file,
        path: `/${kind}/${index}/${field}`, schemaPath: error.schemaPath,
        message: `${typeof record?.['name'] === 'string' ? record['name'] + ': ' : ''}Unknown optional ${field}: ${unknown.slice(0, 5).map(tag => JSON.stringify(tag)).join(', ')}${unknown.length > 5 ? ` (+${unknown.length - 5} more)` : ''}. Stored unchanged; unrecognized tags are not interpreted.` });
    });
    if (!changes.length) continue;
    const copy = structuredClone(root), copied = copy[kind] as Record<string, unknown>[];
    for (const { index, retained } of changes) {
      if (retained.length) copied[index][field] = retained;
      else delete copied[index][field];
    }
    return { value: copy, diagnostics };
  }
  return null;
}
