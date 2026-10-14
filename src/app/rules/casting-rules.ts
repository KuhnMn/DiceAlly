import { object } from '../content/content.model';
import { CharacterDocument, validateCharacterDocument } from './character-document';
import { applySessionAction } from './session-rules';
export type SpellCast = { spellId: string; mode: 'slot'; poolId: string }
  | { spellId: string; mode: 'resource'; costId: string }
  | { spellId: string; mode: 'cantrip' }
  | { spellId: string; mode: 'ritual' | 'at-will'; grantId?: string };
/** Explicit casting costs only. Effects, concentration and equipment restrictions are separate handlers. */
export function castDocumentSpell(document: CharacterDocument,action: SpellCast) {
  const next = validateCharacterDocument(document);
  if (!next.derived) throw new Error('Apply supported character rules before casting.');
  const spell = next.instances.spells.find(s => s.id === action.spellId);
  if (!spell) throw new Error('Unknown selected spell instance.');
  const level = spell.snapshot.data['level'];
  if (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 0 || level > 9) throw new Error('Missing or invalid spell level.');
  const source = next.instances.sources.find(s => s.id === spell.castingSourceId)!;
  const regular = spell.list === 'prepared' || (spell.list === 'known' && source.preparation === 'known');
  let castLevel = level;
  if (action.mode === 'slot') {
    if (!regular) throw new Error('Spell must be prepared or belong to a configured known-spell source.');
    if (level === 0) throw new Error('Cantrips do not use ordinary spell slots.');
    const pool = next.instances.pools.find(p => p.id === action.poolId);
    if (!pool || pool.kind !== 'spell-slots' || typeof pool.rank !== 'number' || pool.rank < level) throw new Error('Select a spell-slot pool at or above the spell level.');
    next.session = applySessionAction(next.session,next.derived.maxHp,next.instances.pools,{ type: 'spend',poolId: pool.id,amount: 1 });
    castLevel = pool.rank;
  } else if (action.mode === 'resource') {
    const cost = next.derived.spellResourceCosts?.find(c => c.id === action.costId && c.spellId === spell.id);
    if (!cost) throw new Error('Resource cost does not belong to this spell.');
    next.session = applySessionAction(next.session,next.derived.maxHp,next.instances.pools,{ type: 'spend',poolId: cost.poolId,amount: cost.amount });
  } else if (action.mode === 'cantrip') {
    if (level !== 0 || !regular) throw new Error('Select a known/prepared cantrip; limited innate grants require their explicit cost.');
  } else if (action.mode === 'at-will' || action.mode === 'ritual') {
    const grants = action.grantId ? spell.grants.filter(g => g.id === action.grantId) : spell.grants;
    if (action.grantId && !grants.length) throw new Error('Unknown spell grant.');
    const explicit = grants.some(g => g.usage['frequency'] === (action.mode === 'at-will' ? 'will' : 'ritual'));
    if (action.mode === 'at-will' && !explicit) throw new Error('No eligible at-will grant.');
    if (action.mode === 'ritual' && !explicit && !(source.ritualCasting === true && regular && object(spell.snapshot.data['meta'])?.['ritual'] === true)) throw new Error('No eligible ritual capability/grant.');
  } else throw new Error('Unsupported spell-casting mode.');
  return { document: validateCharacterDocument(next),spellId: spell.id,sourceId: source.id,castLevel,mode: action.mode };
}
