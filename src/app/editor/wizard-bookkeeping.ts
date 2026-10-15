import { wizardFingerprint } from './wizard-fingerprint';

export interface WizardBaselineEntry {
  path: string[];
  scope: string;
  label: string;
  fingerprint: string;
  editFingerprint?: string;
}

export function createWizardBaseline(entry: {
  path: string[]; scope: string; label: string; value: unknown;
}): WizardBaselineEntry {
  const fingerprint = wizardFingerprint(entry.value);
  const editFingerprint = ['features', 'spells', 'species'].includes(entry.path[0])
    ? wizardFingerprint(entry.value, true) : fingerprint;
  return { path: entry.path, scope: entry.scope, label: entry.label, fingerprint,
    ...(editFingerprint !== fingerprint ? { editFingerprint } : {}) };
}

/**
 * RAW app/viewer imports have no wizard history and need no special conversion.
 * Only the current compact history format is supported.
 */
export function readWizardBookkeeping(value: {
  baseline?: unknown; protectedPaths?: unknown;
}): { baseline: WizardBaselineEntry[]; protectedPaths: string[][] } {
  if ('protectedKeys' in value) throw new Error('Unsupported wizard history format.');
  const readPath = (path: unknown): string[] => {
    if (!Array.isArray(path) || path.some(part => typeof part !== 'string')) throw new Error('Invalid wizard path.');
    return [...path];
  };
  if (value.baseline !== undefined && !Array.isArray(value.baseline)) throw new Error('Unsupported wizard history format.');
  const baseline = ((value.baseline ?? []) as WizardBaselineEntry[]).map(entry => {
    if (!entry || 'value' in entry || typeof entry.scope !== 'string' || typeof entry.label !== 'string'
      || !/^fnv128:[a-f0-9]{32}$/.test(entry.fingerprint)
      || (entry.editFingerprint !== undefined && !/^fnv128:[a-f0-9]{32}$/.test(entry.editFingerprint))) {
      throw new Error('Unsupported wizard history format. Import a RAW character or a current export.');
    }
    return { path: readPath(entry.path), scope: entry.scope, label: entry.label, fingerprint: entry.fingerprint,
      ...(entry.editFingerprint ? { editFingerprint: entry.editFingerprint } : {}) };
  });
  const protectedPaths = value.protectedPaths ?? [];
  if (!Array.isArray(protectedPaths)) throw new Error('Invalid protected wizard paths.');
  return { baseline, protectedPaths: protectedPaths.map(readPath) };
}
