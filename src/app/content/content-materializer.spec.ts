import { ContentCache } from './content-cache';
import { ContentRecord, entityKey, ImportDiagnostic, ImportRevision, JsonObject } from './content.model';
import { generateVariant, materializeContent, mergeSubrace, normalizeSpecies, variantMatches } from './content-materializer';
import { resolveItemView } from './item-resolver';

function record(kind: string, data: JsonObject): ContentRecord {
  return { key: entityKey(kind, data), kind, data, name: String(data['name'] ?? data['abbreviation']), publication: String(data['source'] ?? ''), file: 'synthetic.json', links: [] };
}
class MemoryCache implements ContentCache {
  rows = new Map<string, ContentRecord>();
  async stage(_revision: ImportRevision) {}
  async put(_revision: string, rows: ContentRecord[]) { for (const row of rows) this.rows.set(row.key, row); }
  async get(_revision: string, key: string) { return this.rows.get(key); }
  async visit(_revision: string, visitor: (record: ContentRecord) => Promise<void>) {
    // Snapshot this pass; no reliance on observing inserts during a cursor scan.
    for (const row of [...this.rows.values()]) await visitor(this.rows.get(row.key)!);
  }
  async activate(_revision: ImportRevision) {}
  async discard(_revision: string) { this.rows.clear(); }
}

describe('Secondary content mappings', () => {
  it('expands templates after the variant receives its item-specific resistance', async () => {
    const cache = new MemoryCache(); const diagnostics: ImportDiagnostic[] = [];
    await cache.put('r', [
      record('baseitem', { name: 'Armor', source: 'PHB', armor: true }),
      record('itemEntry', { name: 'Armor of Resistance', source: 'DMG', entriesTemplate: ['Resistance to {{item.resist}}.'] }),
      record('magicvariant', { name: 'Fire Armor', source: 'DMG', requires: [{ armor: true }],
        inherits: { source: 'DMG', namePrefix: 'Fire ', resist: ['fire'], entries: ['{#itemEntry Armor of Resistance}'] } }),
    ]);
    await materializeContent(cache, 'r', diagnostics);
    expect(diagnostics).toEqual([]);
    const item = [...cache.rows.values()].find(record => record.derivation?.operation === 'magicvariant')!;
    expect(item.data['entries']).toEqual(['Resistance to fire.']);
    expect(item.links.some(link => link.role === 'item-entry')).toBe(true);
  });
  it('deduplicates identical inherited language options as an intentional mapping policy', () => {
    const merged = mergeSubrace({ name: 'People', source: 'TEST', entries: [], languageProficiencies: [{ common: true }] },
      { name: 'Variant', source: 'TEST', languageProficiencies: [{ common: true }] });
    expect(merged['languageProficiencies']).toEqual([{ common: true }]);
  });
  it('removes inherited fields when the subrace explicitly supplies null', () => {
    const merged = mergeSubrace({ name: 'People', source: 'TEST', entries: [], speed: 30, resist: ['fire'],
      skillProficiencies: [{ perception: true }], languageProficiencies: [{ common: true }],
    }, { name: 'Variant', source: 'TEST', speed: null, resist: null, skillProficiencies: null, languageProficiencies: null });
    for (const field of ['speed', 'resist', 'skillProficiencies', 'languageProficiencies']) expect(merged[field]).toBeUndefined();
  });
  it('merges subrace overrides and entry replacements without changing the parent', () => {
    const parent = { name: 'People', source: 'TEST', page: 1, size: ['M'], speed: 30, darkvision: 60, creatureTypes: ['humanoid'],
      ability: [{ cha: 2 }], entries: [{ name: 'Shared', entries: ['base'] }, { name: 'Movement', entries: ['walk'] }] };
    const child = { name: 'Sky', source: 'OTHER', speed: { walk: 25, fly: { number: 40, condition: 'when flying' } },
      ability: [{ wis: 1 }], resist: ['cold'], entries: [{ name: 'New Movement', entries: ['fly'], data: { overwrite: 'movement' } }, { name: 'New', entries: ['new'] }] };
    const merged = mergeSubrace(parent, child);
    expect(merged['name']).toBe('Sky People');
    expect(merged['page']).toBe(1);
    expect(merged['darkvision']).toBe(60);
    expect(merged['ability']).toEqual([{ cha: 2, wis: 1 }]);
    expect(merged['speed']).toEqual({ walk: { number: 25 }, fly: { number: 40, condition: 'when flying' } });
    expect(merged['resist']).toEqual([{ type: 'cold' }]);
    expect(merged['entries']).toEqual([parent.entries[0], child.entries[0], child.entries[1]]);
    expect(parent.speed).toBe(30);
    expect(parent.entries[1].name).toBe('Movement');
  });
  it('preserves unmatched overwrite text, defaults unnamed variants, and respects ability overwrite', () => {
    const merged = mergeSubrace({ name: 'People', source: 'TEST', ability: [{ cha: 2 }], entries: [] },
      { source: 'OTHER', ability: [{ str: 1 }], overwrite: { ability: true }, entries: [{ name: 'New', data: { overwrite: 'Missing' }, entries: [] }] });
    expect(merged['name']).toBe('Variant People');
    expect(merged['ability']).toEqual([{ str: 1 }]);
    expect(merged['entries']).toHaveLength(1);
    expect(normalizeSpecies({ speed: { walk: 0, fly: true } })['speed']).toEqual({ walk: { number: 0 }, fly: { number: 0 } });
  });
  it('matches all conditions within one requirement, alternative groups, and exclusions', () => {
    const variant = { requires: [{ weapon: true, dmgType: 'S' }, { armor: true }], excludes: { net: true } };
    expect(variantMatches({ weapon: true, dmgType: 'P' }, variant)).toBe(false);
    expect(variantMatches({ armor: true }, variant)).toBe(true);
    expect(variantMatches({ weapon: true, dmgType: 'S', net: true }, variant)).toBe(false);
    expect(variantMatches({ property: ['F', 'T'] }, { requires: [{ property: ['F', 'V'] }] })).toBe(true);
  });
  it('generates stable base/variant identities with physical values, bonuses and interpolated entries', () => {
    const base = record('baseitem', { name: 'Sword', source: 'TEST', dmg1: '1d8', dmgType: 'S', weight: 3, value: 100, ac: 0,
      property: ['V'], entries: ['base'] });
    const variant = record('magicvariant', { name: 'Magic', requires: [{ weapon: true }], inherits: { namePrefix: '+1 ', source: 'MAGIC', rarity: 'rare',
      reqAttune: true, bonusWeapon: '+1', propertyAdd: ['F', 'F'], propertyRemove: ['V'], valueExpression: '[[baseItem.value]]*2', entries: ['{=baseName} deals {=dmgType} with {=bonusWeapon}.'] } });
    const generated = generateVariant(base, variant);
    expect(generated.data['name']).toBe('+1 Sword');
    expect(generated.data['source']).toBe('MAGIC:TEST');
    expect(generated.data['dmg1']).toBe('1d8');
    expect(generated.data['entries']).toEqual(['base', 'Sword deals slashing with +1.']);
    expect(generated.data['property']).toEqual(['F']);
    expect(generated.data['value']).toBe(200);
    expect(generated.derivation?.inputs.map(i => i.target)).toEqual([base.key, variant.key]);
    expect(generateVariant(base, variant).key).toBe(generated.key);
    expect(base.data['property']).toEqual(['V']);
  });
  it('materializes playable items/species and enriches definitions using explicit publications', async () => {
    const cache = new MemoryCache(); const diagnostics: ImportDiagnostic[] = [];
    await cache.put('r', [
      record('race', { name: 'People', source: 'TEST', speed: 30 }),
      record('subrace', { name: 'Sky', source: 'OTHER', raceName: 'People', raceSource: 'TEST' }),
      record('baseitem', { name: 'Sword', source: 'TEST', type: 'M|TEST', property: [{ uid: 'F|TEST', note: 'Synthetic property note' }], mastery: ['Cleave|TEST'], weight: 3, weapon: true }),
      record('itemType', { name: 'Melee', abbreviation: 'M', source: 'TEST' }),
      record('itemProperty', { name: 'Finesse', abbreviation: 'F', source: 'TEST', entries: ['property'] }),
      record('itemProperty', { name: 'Other Finesse', abbreviation: 'F', source: 'OTHER', entries: ['other'] }),
      record('itemMastery', { name: 'Cleave', source: 'TEST', entries: ['mastery'] }),
      record('item', { name: 'Named Sword', source: 'MAGIC', baseItem: 'Sword|TEST', reqAttune: true, bonusWeaponDamage: '+2' }),
      record('itemGroup', { name: 'Group', source: 'TEST', entries: ['group'], bonusWeaponDamage: '+3', bonusWeaponAttack: '+1' }),
      record('magicvariant', { name: 'Variant', source: 'MAGIC', requires: [{ weapon: true }, { name: 'Sword' }], inherits: { source: 'MAGIC', nameSuffix: ' +1', bonusWeapon: '+1' } }),
    ]);
    const result = await materializeContent(cache, 'r', diagnostics);
    expect(diagnostics).toEqual([]);
    expect(result.added).toBe(5); // Two species, base item, group item, one variant (not two).
    const item = await cache.get('r', entityKey('item', { name: 'Named Sword', source: 'MAGIC' }));
    expect(item?.data['weight']).toBe(3);
    expect(item?.data['reqAttune']).toBe('by anyone');
    expect(item).not.toHaveProperty('display');
    const view = await resolveItemView(cache, 'r', item!);
    expect(view.itemType).toBe('Melee');
    expect(view.properties[0].name).toBe('Finesse');
    expect(view.masteries[0].entry).toBe('mastery');
    expect(item?.data['bonusWeaponDamage']).toBe('+2');
    const group = [...cache.rows.values()].find(r => r.derivation?.operation === 'item-group');
    expect(group?.data['bonusWeaponDamage']).toBe('+3'); // Do not copy Android's attack/damage field mixup.
    const variants = [...cache.rows.values()].filter(r => r.derivation?.operation === 'magicvariant');
    expect(variants).toHaveLength(1);
    expect((await resolveItemView(cache, 'r', variants[0])).properties[0].key).toBe(entityKey('itemProperty', { abbreviation: 'F', source: 'TEST' }));
  });
  it('keeps explicit items when a base projection has the same identity and reports missing definitions', async () => {
    const cache = new MemoryCache(); const diagnostics: ImportDiagnostic[] = [];
    await cache.put('r', [record('baseitem', { name: 'Sword', source: 'TEST', weight: 3 }), record('item', { name: 'Sword', source: 'TEST', weight: 4, property: ['Missing|TEST'] })]);
    await materializeContent(cache, 'r', diagnostics);
    expect((await cache.get('r', entityKey('item', { name: 'Sword', source: 'TEST' })))?.data['weight']).toBe(4);
    expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('Missing'))).toBe(true);
  });
  it('preserves unknown-price formulas, applies combined text formats, and keeps resistance contributions', () => {
    const warnings: string[] = [];
    const generated = generateVariant(record('baseitem', { name: 'Axe', source: 'TEST', resist: ['fire'], vulnerable: ['cold'] }),
      record('magicvariant', { name: 'Magic', inherits: { source: 'MAGIC', valueExpression: '[[baseItem.value]]+100', resist: ['cold'], entries: ['{=baseName/at} {=baseName/l}'] } }), message => warnings.push(message));
    expect(generated.data['value']).toBeUndefined();
    expect(generated.data['valueExpression']).toBe('[[baseItem.value]]+100');
    expect(generated.data['entries']).toEqual(['An axe']);
    expect(generated.data['resist']).toEqual(['fire', 'cold']);
    expect(generated.data['vulnerable']).toEqual([]);
    expect(warnings).toHaveLength(1);
  });
  it('resolves bare legacy DMG definitions but never crosses an explicit missing publication', async () => {
    const cache = new MemoryCache(); const diagnostics: ImportDiagnostic[] = [];
    await cache.put('r', [
      record('itemType', { name: 'Ship', abbreviation: 'SHP', source: 'DMG' }),
      record('itemType', { name: 'New Ship', abbreviation: 'SHP', source: 'XPHB' }),
      record('item', { name: 'Old Boat', source: 'TEST', type: 'SHP' }),
      record('item', { name: 'Unresolved Boat', source: 'TEST', type: 'SHP|MISSING' }),
    ]);
    await materializeContent(cache, 'r', diagnostics);
    const boat = (await cache.get('r', entityKey('item', { name: 'Old Boat', source: 'TEST' })))!;
    expect((await resolveItemView(cache, 'r', boat)).itemType).toBe('Ship');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('SHP|MISSING');
  });
});
