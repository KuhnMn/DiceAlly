import { object, normalize } from './content.model';
import { SpellClassMembership, SpellMemberships } from './spell.model';

function uniqueClasses(...groups: unknown[]): SpellClassMembership[] {
  const result = new Map<string, SpellClassMembership>();
  for (const group of groups) {
    if (group === undefined) continue;
    if (!Array.isArray(group)) throw new Error('Spell class memberships must be arrays.');
    for (const row of group) {
      const entry = object(row);
      if (!entry || typeof entry['name'] !== 'string' || typeof entry['source'] !== 'string'
        || Object.keys(entry).some(key => !['name', 'source', 'definedInSource'].includes(key))) throw new Error('Invalid spell class membership.');
      const membership: SpellClassMembership = { name: entry['name'], source: entry['source'],
        ...(entry['definedInSource'] === undefined ? {} : { definedInSource: entry['definedInSource'] as string }) };
      result.set(JSON.stringify([normalize(membership.name), normalize(membership.source), membership.definedInSource ?? '']), membership);
    }
  }
  return [...result.values()];
}

/** Inline source fields and sources.json aliases are distinct, reviewed input profiles. */
export function mergeSpellMemberships(inline: unknown, overlay: unknown): SpellMemberships {
  // Flat lists are the historical Android/native snapshot compatibility form.
  const inlineData = Array.isArray(inline) ? { fromClassList: inline } : object(inline);
  const overlayData = object(overlay);
  if (overlay !== undefined && !overlayData) throw new Error('Invalid spell membership overlay.');
  if (Object.keys(overlayData ?? {}).some(key => !['class', 'classVariant'].includes(key))) throw new Error('Unknown spell membership overlay field.');
  if (inline !== undefined && inline !== null && !inlineData) throw new Error('Invalid inline spell memberships.');
  if (Object.keys(inlineData ?? {}).some(key => !['fromClassList', 'fromClassListVariant', 'fromSubclass'].includes(key))) throw new Error('Unknown inline spell membership field.');
  return {
    fromClassList: uniqueClasses(inlineData?.['fromClassList'], overlayData?.['class']),
    fromClassListVariant: uniqueClasses(inlineData?.['fromClassListVariant'], overlayData?.['classVariant']),
    ...(inlineData?.['fromSubclass'] === undefined ? {} : { fromSubclass: structuredClone(inlineData['fromSubclass']) as SpellMemberships['fromSubclass'] }),
  };
}
