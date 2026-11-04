import type { ExportedCharacter } from './character.model';
import { validateUsesTotal } from './uses-total';
import { wizardFingerprint } from '../editor/wizard-fingerprint';

type StoredObject = Record<string, unknown>;

/** Upgrade split Android/v1.9 limits once at the document boundary. */
function migrateTracker(tracker: StoredObject, resource = false): void {
  if (!tracker || typeof tracker !== 'object' || Array.isArray(tracker)) throw new Error('Invalid use tracker.');
  if (!resource && tracker['total'] !== undefined) validateUsesTotal(tracker['total']);
  if (typeof tracker['total'] === 'object' && tracker['total'] !== null) {
    validateUsesTotal(tracker['total']);
  } else {
    const calculation = tracker['totalCalculation'];
    const fixed = resource ? tracker['total'] : tracker['totalFreeUses'] ?? 1;
    if (calculation === undefined) tracker['total'] = { kind: 'fixed', value: fixed };
    else {
      if (!calculation || typeof calculation !== 'object' || Array.isArray(calculation)) throw new Error('Invalid uses total.');
      const old = calculation as StoredObject;
      tracker['total'] = old['kind'] === 'fixed' ? { kind: 'fixed', value: fixed }
        : old['kind'] === 'proficiency-bonus' ? { ...old, multiplier: old['multiplier'] === undefined ? 1 : old['multiplier'] } : { ...old };
    }
    validateUsesTotal(tracker['total']);
  }
  tracker['used'] ??= tracker['usedFreeUses'] ?? 0;
  if (!Number.isSafeInteger(tracker['used']) || Number(tracker['used']) < 0) throw new Error('Invalid used count.');
  delete tracker['totalCalculation'];
  delete tracker['totalFreeUses'];
  delete tracker['usedFreeUses'];
}

/** Mutates only the detached portable copy, preserving caller data and wizard edit protection. */
export function migrateCharacterUses(sheet: ExportedCharacter): void {
  for (const entry of [...sheet.features ?? [], ...sheet.spells ?? [], ...sheet.inventory ?? [],
    ...sheet.monsters ?? [], ...sheet.objects ?? [], ...(sheet.species ? [sheet.species] : [])]) {
    for (const tracker of entry.uses ?? []) migrateTracker(tracker as unknown as StoredObject);
  }
  for (const resource of sheet.resources ?? []) {
    const old = structuredClone(resource);
    migrateTracker(resource as unknown as StoredObject, true);
    for (const baseline of sheet.creatorWizard?.baseline ?? []) {
      if (baseline.path[0] !== 'resources' || baseline.path[1] !== resource.id) continue;
      if (baseline.fingerprint === wizardFingerprint(old)) baseline.fingerprint = wizardFingerprint(resource);
      if (baseline.editFingerprint === wizardFingerprint(old)) baseline.editFingerprint = wizardFingerprint(resource);
      const fields = baseline.fieldFingerprints;
      const calculation = (old as unknown as StoredObject)['totalCalculation'] as StoredObject | undefined;
      if ((!calculation || calculation['kind'] === 'fixed') && fields?.['total'] === wizardFingerprint(old.total)) {
        fields['total'] = wizardFingerprint(resource.total);
      }
      if (fields) delete fields['totalCalculation'];
    }
  }
}
