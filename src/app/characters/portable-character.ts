import type { ExportedCharacter } from '../models/character.model';
import { validateSpeciesEntity } from '../content/species-compatibility';

/** Android's installation identity has no role in account-owned characters. Never persist or export it. */
export function portableCharacter(input: ExportedCharacter): ExportedCharacter {
  const sheet = structuredClone(input);
  validateSpeciesEntity(sheet.species?.entity);
  Reflect.deleteProperty(sheet, 'installationId');
  return sheet;
}
