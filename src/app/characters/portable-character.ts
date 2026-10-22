import type { ExportedCharacter } from '../models/character.model';
import { validateSpeciesEntity } from '../content/species-compatibility';
import { decodeCharacterSpeeds } from '../models/character-speed';
import { wizardFingerprint } from '../editor/wizard-fingerprint';
import { validateObjectCompanions } from '../models/companions';

/** Android's installation identity has no role in account-owned characters. Never persist or export it. */
export function portableCharacter(input: ExportedCharacter): ExportedCharacter {
  const sheet = structuredClone(input);
  if (sheet.character) {
    const previous: unknown = sheet.character.speeds;
    sheet.character.speeds = decodeCharacterSpeeds(previous);
    // Move old per-mode wizard bookkeeping to stable list-entry paths without losing manual edits.
    if (previous && !Array.isArray(previous) && typeof previous === 'object' && sheet.creatorWizard) {
      for (const baseline of sheet.creatorWizard.baseline) {
        if (baseline.path[0] !== 'character' || baseline.path[1] !== 'speeds') continue;
        const mode = baseline.path[2];
        const entry = sheet.character.speeds?.find(speed => speed.id === mode);
        const old = (previous as Record<string, unknown>)[mode];
        const unchanged = wizardFingerprint(old) === (baseline.editFingerprint ?? baseline.fingerprint);
        baseline.path = ['speeds', mode];
        if (unchanged) { baseline.fingerprint = wizardFingerprint(entry); baseline.editFingerprint = wizardFingerprint(entry); }
      }
      sheet.creatorWizard.protectedPaths = sheet.creatorWizard.protectedPaths.map(path => path[0] === 'character' && path[1] === 'speeds' ? ['speeds', path[2]] : path);
    }
  }
  validateSpeciesEntity(sheet.species?.entity);
  validateObjectCompanions(sheet.objects);
  Reflect.deleteProperty(sheet, 'installationId');
  return sheet;
}
