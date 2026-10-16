import { CombatAction, Entry, ExportedCharacter, FeatureEntryFull, InventoryItem, Monster, Species, SpellEntryFull } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { featureSourceStats } from './feature-source-stats';
import { newEditorId } from './editor-identity';

export const COMBAT_TYPES = [
  { value: 'ACTION', label: 'Action' }, { value: 'BONUS', label: 'Bonus Action' },
  { value: 'REACTION', label: 'Reaction' }, { value: 'OTHER', label: 'Other' },
] as const;
export type CombatResource = FeatureEntryFull | SpellEntryFull | InventoryItem | Monster | Species;
export type CombatResourceType = 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE' | 'SPELL' | 'ITEM' | 'MONSTER' | 'SPECIES';
const SAVE_ABILITIES: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

/** Read only textual entries, ignoring unrelated numbers and metadata in imported definitions. */
export function combatText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\{@\w+ ([^{}]+)\}/g, (_, body: string) => body.split('|')[0]).replace(/\*\*/g, '');
  if (Array.isArray(value)) return value.map(combatText).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';
  const entry = value as Record<string, unknown>;
  return combatText(entry['text'] ?? entry['entries'] ?? entry['items'] ?? '');
}
export function resourceEntries(resource: CombatResource): unknown {
  const feature = resource as FeatureEntryFull;
  if (feature.featureEntity || feature.featEntity || feature.optionalFeatureEntity) return (feature.featureEntity ?? feature.featEntity ?? feature.optionalFeatureEntity)?.entries;
  const entity = (resource as InventoryItem).entity;
  if (entity && 'item' in entity) return entity.item.entries ?? entity.baseItem?.entries;
  return (resource as SpellEntryFull).entity?.entries;
}
export function monsterCombatOptions(monster: Monster) {
  return [
    ...(monster.entity?.action ?? []).map(action => ({ ...action, type: 'ACTION' })),
    ...((monster.entity as unknown as { bonus?: { name?: string; entries?: Entry[] }[] })?.bonus ?? []).map(action => ({ ...action, type: 'BONUS' })),
    ...(monster.entity?.reaction ?? []).map(action => ({ ...action, type: 'REACTION' })),
    ...(monster.entity?.trait ?? []).map(action => ({ ...action, type: 'OTHER' })),
  ];
}

/** Suggestions are editable snapshots. Never interpret an arbitrary imported formula as executable code. */
export function prefillCombatAction(sheet: ExportedCharacter, resource: CombatResource, type: CombatResourceType,
  helpers: CharacterHelpersService, monsterOption = 0): CombatAction {
  let entries = resourceEntries(resource);
  let name = resource.name || 'Combat Ability';
  let actionType: string = 'ACTION';
  let range = '';
  let hitOrDc = '';
  if (type === 'MONSTER') {
    const action = monsterCombatOptions(resource as Monster)[monsterOption];
    if (action) { entries = action.entries; name = `${resource.name}: ${action.name || 'Ability'}`; actionType = action.type; }
  }
  const text = combatText(entries);
  const sourceName = (resource as SpellEntryFull).castingSourceName ?? (resource as FeatureEntryFull).featureSourceName;
  const source = sheet.character?.featureSources?.find(value => value.name === sourceName);
  const stat = source && sheet.character ? featureSourceStats(source, sheet.character, helpers)[0] : undefined;
  const spell = type === 'SPELL' ? (resource as SpellEntryFull).entity : undefined;
  if (spell) {
    const unit = spell.time?.[0]?.unit;
    actionType = unit === 'bonus' ? 'BONUS' : unit === 'reaction' ? 'REACTION' : unit === 'action' ? 'ACTION' : 'OTHER';
    const distance = spell.range?.distance;
    range = distance?.amount != null ? `${distance.amount} ${distance.type || 'ft.'}` : distance?.type ?? spell.range?.type ?? '';
    if (spell.savingThrow?.length) hitOrDc = `${stat?.save != null ? `DC ${stat.save}` : 'DC ?'} ${spell.savingThrow.map(ability => SAVE_ABILITIES[ability] ?? ability).join('/')}`;
    else if (spell.spellAttack?.length && stat) hitOrDc = `${stat.attack} to hit`;
  }
  if (!spell && type !== 'MONSTER') {
    if (/bonus action/i.test(text)) actionType = 'BONUS';
    else if (/\breaction\b/i.test(text)) actionType = 'REACTION';
  }
  const raw = JSON.stringify(entries ?? '');
  const hit = raw.match(/\{@hit ([+-]?\d+)\}/i) ?? text.match(/([+-]\d+)\s+to hit/i);
  const dc = raw.match(/\{@dc (\d+)\}/i) ?? text.match(/\bDC\s+(\d+)/i);
  if (hit) hitOrDc = `${helpers.formatSigned(Number(hit[1]))} to hit`;
  else if (dc) hitOrDc = `DC ${dc[1]} ${text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) (?:saving throw|save)/i)?.[1] ?? ''}`.trim();
  else if (!hitOrDc && stat && /saving throw/i.test(text)) hitOrDc = `DC ${stat.save ?? '?'} ${text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i)?.[1] ?? ''}`.trim();
  if (!range) range = text.match(/(?:reach|range)\s+(\d+\s*(?:feet|ft\.?))/i)?.[1] ?? '';
  const dice = [...raw.matchAll(/\{@(?:damage|dice) ([^}|]+)(?:\|[^}]*)?\}/g)].map(match => match[1]);
  let damageOrHeal = dice.length ? [...new Set(dice)].join(' / ') : text.split(/(?<=[.!?])\s/)[0]?.slice(0, 240) ?? '';
  if (spell?.damageInflict?.length && dice.length) damageOrHeal += ` ${spell.damageInflict.map(type => type.charAt(0).toUpperCase() + type.slice(1)).join('/')}`;
  if (type === 'ITEM') {
    const item = (resource as InventoryItem).entity;
    const weapon = { ...item?.baseItem, ...item?.item };
    if (weapon.dmg1 && sheet.character) {
      const scores = sheet.character.abilityScores;
      const strength = helpers.modifierNumber(scores?.strength), dexterity = helpers.modifierNumber(scores?.dexterity);
      const finesse = item?.properties?.some(property => /finesse/i.test(property.name));
      const modifier = finesse ? Math.max(strength, dexterity) : weapon.type?.startsWith('R') ? dexterity : strength;
      const bonus = Number(weapon.bonusWeapon ?? 0) || 0;
      hitOrDc = `${helpers.formatSigned(modifier + helpers.proficiencyBonus(sheet.character) + bonus)} to hit`;
      const damageTypes: Record<string, string> = { S: 'Slashing', P: 'Piercing', B: 'Bludgeoning', F: 'Fire', C: 'Cold', L: 'Lightning', N: 'Necrotic', R: 'Radiant', O: 'Force', Y: 'Psychic', I: 'Poison', A: 'Acid', T: 'Thunder' };
      damageOrHeal = `${weapon.dmg1} ${helpers.formatSigned(modifier + bonus)} ${damageTypes[weapon.dmgType ?? ''] ?? weapon.dmgType ?? ''}`.trim();
      range = weapon.range ?? 'Melee';
    }
  }
  return { editorId: newEditorId(), name, range, actionType, hitOrDc, damageOrHeal,
    linkedResourceType: type, linkedResource: { editorId: resource.editorId, name: resource.name, source: resource.source } };
}

/** Resolve identity first so renaming an entry does not break its bookmark. RAW imports still use names. */
export function resolveCombatResource(sheet: ExportedCharacter, action: CombatAction): CombatResource | undefined {
  const type = action.linkedResourceType;
  const candidates: CombatResource[] = type === 'SPELL' ? sheet.spells ?? [] : type === 'ITEM' ? sheet.inventory ?? []
    : type === 'MONSTER' ? sheet.monsters ?? [] : type === 'SPECIES' ? sheet.species ? [sheet.species] : [] : sheet.features ?? [];
  const link = action.linkedResource;
  if (!link) return;
  return link.editorId ? candidates.find(value => value.editorId === link.editorId)
    : candidates.find(value => value.name === link.name && (value.source ?? '') === (link.source ?? ''));
}
