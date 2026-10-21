import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord } from './content.model';
import validate from './generated/attached-spells-validators.mjs';

export type AttachedSpells = NonNullable<BrewSourceByKind['item']['attachedSpells']>;
/** Exact UID lists or usage groups; this describes references, not casting automation. */
export function attachedSpells(record: ContentRecord): AttachedSpells | undefined {
  const value = record.data['attachedSpells'];
  // Historical snapshots used null/empty lists when no spells were attached.
  if (value == null || (Array.isArray(value) && value.length === 0)) return undefined;
  if (!validate(value)) {
    const issue = validate.errors?.[0];
    throw new Error(`Invalid attachedSpells at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
  return value as AttachedSpells;
}
export function visitAttachedSpells(
  value: AttachedSpells,
  visit: (uid: string, path: string) => void,
): void {
  const list = (spells: string[], path: string) => spells.forEach((uid, position) => visit(uid, `${path}[${position}]`));
  if (Array.isArray(value)) {
    list(value, 'attachedSpells');
    return;
  }
  for (const field of Object.keys(value) as (keyof typeof value)[]) {
    if (field === 'ability' || field === 'resourceName') continue;
    if (field === 'will' || field === 'ritual' || field === 'other') list(value[field]!, `attachedSpells.${field}`);
    else {
      // Source validation establishes numeric/count-keyed maps (generated index values are unknown).
      const groups = value[field] as Record<string, string[]>;
      for (const [count, spells] of Object.entries(groups)) list(spells, `attachedSpells.${field}.${count}`);
    }
  }
}
