import { stableHash128 } from './stable-hash';
import { ExportedCharacter } from '../models/character.model';
import { portableCharacter } from '../characters/portable-character';

/** Instance identity is separate from content provenance: one definition can have several sheet entries. */
export function newEditorId(): string { return crypto.randomUUID(); }

/**
 * Called by class-wizard-preview.ts when proposing sources, features, spells and species.
 * The seed is JSON [kind, ...parts]: typically library identity, class selection ID,
 * and content key; spells also include casting source and list (Spelllist/Prepared/Spellbook).
 * We hash its UTF-8 bytes using FNV-1a 128, format the result as a version-8 UUID,
 * and prefix it with "hash:". Equal seeds produce equal IDs across wizard runs.
 * Revision/commit and editable descriptions are excluded so library updates do not
 * change instance identity. Manual entries use newEditorId() instead.
 * This is an identity hash, not a security primitive or a hash of the entire entry.
 */
export function wizardEditorId(kind: string, ...parts: string[]): string {
  const seed = JSON.stringify([kind, ...parts]);
  const hex = stableHash128(seed);
  // UUID version 8 is reserved for application-defined layouts; retain the standard variant bits.
  const variant = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `hash:${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
}

/** Initialize missing editor identities in RAW imports; existing current-format identities stay unchanged. */
export function normalizeCharacterEditorIdentity(input: ExportedCharacter): ExportedCharacter {
  const sheet = portableCharacter(input);
  const characterId = sheet.character?.characterUuid ?? '';
  const normalizeEntry = (entry: object, kind: string, position: number) => {
    const value = entry as Record<string, unknown>;
    const previous = value['editorId'];
    if (typeof previous === 'string') value['editorId'] = previous;
    else {
      const reference = value['contentReference'] as { sourceIdentity: string; key: string } | undefined;
      value['editorId'] = kind === 'species' && reference && value['userAdded'] === false
        ? wizardEditorId('species', reference.sourceIdentity, reference.key)
        : wizardEditorId('imported-entry', characterId, kind, String(position), String(value['name'] ?? ''));
    }
  };
  for (const [kind, entries] of [
    ['source', sheet.character?.featureSources], ['feature', sheet.features], ['spell', sheet.spells], ['monster', sheet.monsters], ['item', sheet.inventory], ['combat-action', sheet.combatActions],
  ] as const) entries?.forEach((entry, index) => normalizeEntry(entry, kind, index));
  if (sheet.species) normalizeEntry(sheet.species, 'species', 0);
  return sheet;
}
