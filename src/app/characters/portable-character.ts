import type { ExportedCharacter } from '../models/character.model';

/** Android's installation identity has no role in account-owned characters. Never persist or export it. */
export function portableCharacter(input: ExportedCharacter): ExportedCharacter {
  const sheet = structuredClone(input);
  Reflect.deleteProperty(sheet, 'installationId');
  return sheet;
}
