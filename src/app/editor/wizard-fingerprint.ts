import { stableHash128 } from './stable-hash';

/** Session counters never constitute manual edits to a wizard-generated definition. */
export function comparableWizardValue(value: unknown, excludeAnnotations = false): unknown {
  if (Array.isArray(value)) return value.map(entry => comparableWizardValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => entry !== undefined && key !== 'used' && key !== 'usedFreeUses' && key !== 'overrideFeet'
      && (!excludeAnnotations || (key !== 'notes' && key !== 'uses')))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, comparableWizardValue(entry)]));
}

/** Only a fixed-size digest is exported; the actual generated content lives once in the sheet. */
export function wizardFingerprint(value: unknown, excludeAnnotations = false): string {
  return `fnv128:${stableHash128(JSON.stringify(comparableWizardValue(value, excludeAnnotations)) ?? 'undefined')}`;
}
