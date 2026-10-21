import { attachedSpells, AttachedSpellUsage, visitAttachedSpells } from '../content/attached-spells';
import { ContentCache } from '../content/content-cache';
import { ContentRecord } from '../content/content.model';
import { DisplayItem, ItemAttachedSpell } from '../models/character.model';
import { spellSnapshot } from './spell-selection';

function usageNote(usage: AttachedSpellUsage): string | undefined {
  const each = usage.each ? ' each' : '';
  switch (usage.type) {
    case 'will': return 'At will';
    case 'ritual': return 'Ritual';
    case 'daily': return `${usage.count}/day${each}`;
    case 'rest': return `${usage.count}/rest${each}`;
    case 'limited': return `${usage.count} use${usage.count === 1 ? '' : 's'}${each}; see item description`;
    case 'charges': return `${usage.count} charge${usage.count === 1 ? '' : 's'}`;
    case 'resource': return `${usage.resourceName ?? 'Resource'} cost: ${usage.count}`;
    case 'other': return undefined;
  }
}

const ABILITIES: Readonly<Record<string, string>> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  inherit: 'Uses the selected spellcasting ability',
};

/** Resolve once when acquiring/refreshing equipment; the sheet reads only the resulting snapshot. */
export async function prepareItemAttachedSpells(cache: Pick<ContentCache, 'get'>, item: ContentRecord, revisionId: string): Promise<Pick<DisplayItem, 'attachedSpells' | 'spellcastingAbilityDescription'>> {
  const source = attachedSpells(item);
  if (!source) return {};
  const references: { uid: string; path: string; usage: AttachedSpellUsage }[] = [];
  visitAttachedSpells(source, (uid, path, usage) => references.push({ uid, path, usage }));
  const spells = new Map<string, ItemAttachedSpell>();
  for (const reference of references) {
    const link = item.links.find(link => link.role === 'spell-grant' && link.path === reference.path && link.status !== 'missing' && link.status !== 'ambiguous');
    const key = link?.target ?? reference.uid;
    const note = usageNote(reference.usage);
    const existing = spells.get(key);
    if (existing) {
      if (note && !existing.usageNotes.includes(note)) existing.usageNotes.push(note);
      continue;
    }
    const [name, source] = reference.uid.split('|');
    const record = link ? await cache.get(revisionId, link.target) : undefined;
    if (link && (!record || record.kind !== 'spell')) throw new Error(`Missing attached spell for ${item.name}: ${reference.uid}. Reimport content.`);
    spells.set(key, { name: record?.name ?? name, ...(record?.publication || source ? { source: record?.publication ?? source } : {}),
      usageNotes: note ? [note] : [], ...(record ? { spell: spellSnapshot(record) } : {}) });
  }
  const ability = Array.isArray(source) ? undefined : source.ability;
  const abilityDescription = typeof ability === 'string' ? ABILITIES[ability] ?? ability
    : ability ? `Choose ${ability.choose.map(value => ABILITIES[value] ?? value).join(' or ')}` : undefined;
  return { ...(spells.size ? { attachedSpells: [...spells.values()] } : {}),
    ...(abilityDescription ? { spellcastingAbilityDescription: abilityDescription } : {}) };
}
