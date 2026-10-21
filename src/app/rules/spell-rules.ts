import { additionalSpells, AdditionalSpells, SPELL_GRANT_LISTS, SpellGrantLevel, visitSpellGrantGroups } from '../content/additional-spells';
import { canonicalSpellRecord } from '../content/spell-adapter';
import { ContentRecord, entityKey, JsonObject } from '../content/content.model';
import { ContentRulesIndex } from './feature-rules';
import { describeSpellChoice, isCompleteSelection, isSpellRequirementMet, spellChoiceQuery } from './spell-choice';
import { spellUsageCount } from './spell-usage';

export interface SpellGrantOwner {
  selectionId: string;
  ownerKey: string;
  level: number;
  maxSpellLevel?: number;
  ability?: string;
  /** Multiple additionalSpells blocks require explicit selection, never automatic union. */
  blocks?: number[];
}
export interface SpellGrant {
  id: string;
  ownerKey: string;
  selectionId: string;
  path: string;
  ability?: string;
  usage: JsonObject;
}
export interface SpellInstance {
  // The instance owns user edits; grants own generated eligibility and usage definitions.
  id: string;
  sourceIdentity: string;
  revisionId: string;
  contentKey: string;
  castingSourceId: string;
  list: 'innate' | 'known' | 'prepared';
  usageKey: string;
  manual: boolean;
  grants: SpellGrant[];
  snapshot: ContentRecord;
  customization: JsonObject;
}
export interface SpellChoice {
  id: string;
  count: number;
  candidates: string[];
  query?: unknown;
}
export interface SpellPreview {
  canAccept: boolean;
  instances: SpellInstance[];
  removed: SpellInstance[];
  expanded: { castingSourceId: string; contentKey: string; grant: SpellGrant }[];
  choices: SpellChoice[];
  diagnostics: string[];
}
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
/** Preview additionalSpells. Unsupported filter syntax blocks acceptance. */
export function deriveSpellGrants(owners: SpellGrantOwner[], index: ContentRulesIndex,
  previous: SpellInstance[] = [], answers: Readonly<Record<string, readonly string[]>> = {},
  suppressedGrantIds: readonly string[] = []): SpellPreview {
  const diagnostics: string[] = []; const choices: SpellChoice[] = [];
  // Expanded lists offer choices; they do not grant known/prepared spells automatically.
  const expanded: SpellPreview['expanded'] = []; const wanted = new Map<string, SpellInstance>();
  const suppressed = new Set(suppressedGrantIds); const ownerIds = new Set<string>();
  if (!index.sourceIdentity || !index.revisionId) diagnostics.push('A pinned content source/revision is required.');
  if (new Set(previous.map(s => s.id)).size !== previous.length) diagnostics.push('Spell instance IDs must be unique.');
  for (const owner of owners) {
    const ownerId = JSON.stringify([owner.selectionId, owner.ownerKey]);
    if (!owner.selectionId || ownerIds.has(ownerId) || !Number.isInteger(owner.level) || owner.level < 1 || owner.level > 20) {
      diagnostics.push('Invalid or duplicate spell grant owner.'); continue;
    }
    ownerIds.add(ownerId);
    if (owner.maxSpellLevel !== undefined && (!Number.isInteger(owner.maxSpellLevel) || owner.maxSpellLevel < 0 || owner.maxSpellLevel > 9)) {
      diagnostics.push('Invalid maximum spell level.'); continue;
    }
    const record = index.records.get(owner.ownerKey);
    if (!record) { diagnostics.push(`Missing spell grant owner: ${owner.ownerKey}`); continue; }
    let blocks: AdditionalSpells | undefined;
    try { blocks = additionalSpells(record); } catch (error) { diagnostics.push(String(error)); continue; }
    if (!blocks) continue;
    if (blocks.length > 1 && owner.blocks === undefined) {
      diagnostics.push(`Choose additionalSpells blocks explicitly for ${owner.ownerKey}.`); continue;
    }
    const selected = owner.blocks ?? blocks.map((_, i) => i);
    if (new Set(selected).size !== selected.length || selected.some(i => !Number.isInteger(i) || i < 0 || i >= blocks.length)) {
      diagnostics.push('Invalid additionalSpells block selection.'); continue;
    }
    for (const position of selected) {
      const block = blocks[position];
      const sourceId = JSON.stringify(['casting-source', index.sourceIdentity, owner.selectionId, owner.ownerKey, position]);
      const abilityOptions = typeof block.ability === 'object' ? block.ability.choose : undefined;
      const ability = typeof block['ability'] === 'string' ? block['ability'] : owner.ability;
      if ((ability !== undefined && !ABILITIES.includes(ability))
        || (abilityOptions && (!ability || !abilityOptions.some(option => option === ability)))) {
        diagnostics.push(`Select a valid casting ability for ${sourceId}.`); continue;
      }
      const keyFor = (token: string): string => {
        const [name, publication] = token.replace(/#[^#]*$/, '').split('|');
        if (!name?.trim()) throw new Error('Empty spell reference.');
        const key = entityKey('spell', { name: name.trim(), source: publication?.trim() || 'PHB' });
        if (index.records.get(key)?.kind !== 'spell') throw new Error(`Missing qualified spell: ${token}`);
        return key;
      };
      const add = (key: string, list: 'innate' | 'known' | 'prepared' | 'expanded', path: string, usage: JsonObject) => {
        const grant: SpellGrant = {
          id: JSON.stringify(['spell-grant', sourceId, list, path, key]),
          ownerKey: owner.ownerKey, selectionId: owner.selectionId, path, ability, usage: structuredClone(usage)
        };
        if (suppressed.has(grant.id)) return;
        if (list === 'expanded') { expanded.push({ castingSourceId: sourceId, contentKey: key, grant }); return; }
        const usageKey = list === 'innate' ? JSON.stringify(usage) : '';
        const identity = JSON.stringify(['spell-instance', sourceId, list, key, usageKey]);
        let instance = wanted.get(identity);
        if (!instance) {
          const matches = previous.filter(s => s.sourceIdentity === index.sourceIdentity && s.castingSourceId === sourceId
            && s.list === list && s.contentKey === key && s.usageKey === usageKey);
          if (matches.length > 1) throw new Error(`Ambiguous previous spell instance: ${key}`);
          const old = matches[0];
          if (old && old.revisionId !== index.revisionId) throw new Error(`Explicit content update required for ${key}.`);
          instance = old ? { ...structuredClone(old), grants: [] } : {
            id: identity, sourceIdentity: index.sourceIdentity,
            revisionId: index.revisionId, contentKey: key, castingSourceId: sourceId, list, usageKey, manual: false,
            grants: [], snapshot: canonicalSpellRecord(index.records.get(key)!), customization: {}
          };
          wanted.set(identity, instance);
        }
        if (!instance.grants.some(g => g.id === grant.id)) instance.grants.push(grant);
      };
      const walk = (value: SpellGrantLevel, list: typeof SPELL_GRANT_LISTS[number], path: string): void => {
        if (!Array.isArray(value) && value.limited !== undefined) {
          throw new Error(`Unsupported spell grant structure at ${path}.limited`);
        }
        visitSpellGrantGroups(value, path, (entries, groupPath, frequency, count) => {
          if (count !== undefined && frequency !== 'resource' && !spellUsageCount(count)) {
            throw new Error(`Invalid spell usage count: ${count} at ${path}.${frequency}`);
          }
          const usage: JsonObject = frequency === undefined || frequency === '_' ? {}
            : count === undefined ? { frequency } : { frequency, count, resourceName: block.resourceName };
          entries.forEach((entry, position) => {
            const entryPath = `${groupPath}[${position}]`;
            if (typeof entry === 'string') { add(keyFor(entry), list, entryPath, usage); return; }
            const id = JSON.stringify(['spell-choice', sourceId, list, entryPath]);
            let definition;
            try {
              definition = describeSpellChoice(entry, index.records, keyFor);
            } catch (error) {
              // Keep unsupported filters visible so the editor can offer manual completion.
              const query = spellChoiceQuery(entry);
              if (query !== undefined) choices.push({ id, count: 'count' in entry ? entry.count ?? 1 : 1, candidates: [], query });
              throw error;
            }
            const { count: choiceCount, candidates, query, all } = definition;
            if (all) { candidates.forEach(key => add(key, list, `${entryPath}.all`, usage)); return; }
            choices.push({ id, count: choiceCount, candidates, ...(query !== undefined ? { query } : {}) });
            const answer = answers[id] ?? [];
            if (!isCompleteSelection(answer, choiceCount, candidates)) throw new Error(`Select ${choiceCount} valid spell(s) at ${entryPath}.`);
            answer.forEach(key => add(key, list, `${entryPath}.choice`, usage));
          });
        });
      };
      for (const list of SPELL_GRANT_LISTS) {
        if (block[list] === undefined) continue;
        const levels = block[list]!;
        for (const [requirement, value] of Object.entries(levels)) {
          try {
            if (isSpellRequirementMet(requirement, owner.level, owner.maxSpellLevel)) {
              walk(value, list, `additionalSpells[${position}].${list}.${requirement}`);
            }
          } catch (error) { diagnostics.push(String(error)); }
        }
      }
    }
  }
  const instances = structuredClone(previous.filter(s => s.manual || s.sourceIdentity !== index.sourceIdentity)
    .map(s => ({ ...s, grants: s.sourceIdentity === index.sourceIdentity ? [] : s.grants })));
  for (const instance of wanted.values()) {
    const position = instances.findIndex(s => s.id === instance.id);
    if (position >= 0 && (instances[position].contentKey !== instance.contentKey || instances[position].castingSourceId !== instance.castingSourceId)) {
      diagnostics.push(`Spell instance ID collision: ${instance.id}`); continue;
    }
    if (position >= 0) instances[position] = instance; else instances.push(instance);
  }
  const retained = new Set(instances.map(s => s.id));
  return {
    canAccept: diagnostics.length === 0, instances: diagnostics.length ? structuredClone(previous) : instances,
    removed: diagnostics.length ? [] : structuredClone(previous.filter(s => !retained.has(s.id))), expanded, choices, diagnostics
  };
}
