import { buildReferenceIndex, ContentReferenceIndex, linkContent } from './content-linker';
import { ContentRecord, entityKey, JsonObject } from './content.model';
import { generateVariant } from './content-materializer';
import { referenceEdition } from './reference-edition';

function record(kind: string, name: string, data: JsonObject = {}): ContentRecord {
  const raw = { name, source: 'PHB', ...data };
  return { kind, name, data: raw, key: entityKey(kind, raw), publication: String(raw.source), file: 'test.json', links: [] };
}
function index(...records: ContentRecord[]) {
  const result = new ContentReferenceIndex(); records.forEach(r => result.add(r)); return result;
}
describe('Content reference linking', () => {
  it('links status descriptions to their own category and honors edition-qualified references', () => {
    const classic = record('status', 'Concentration');
    const revised = record('status', 'Concentration', { source: 'XPHB' });
    const condition = record('condition', 'Concentration', { source: 'XPHB' });
    const holder = record('spell', 'Example', { source: 'XPHB', entries: ['{@status concentration}', '{@status Concentration|PHB}'] });
    const result = linkContent(holder, index(classic, revised, condition));
    expect(result.diagnostics).toEqual([]);
    expect(result.links.map(link => [link.role, link.target])).toEqual([['entry-status', revised.key], ['entry-status', classic.key]]);
  });
  it('prefers the standard playable species over its exact base, independent of scan order', async () => {
    const parent = record('race', 'Human');
    const base = { ...record('species', 'Human'), key: JSON.stringify(['species', parent.key]) };
    const sub = record('subrace', '', { raceName: 'Human', raceSource: 'PHB' });
    const standard = { ...record('species', 'Variant Human'), key: JSON.stringify(['species', sub.key]) };
    standard.derivation = { operation: 'subrace', version: 1, inputs: [
      { role: 'subrace-definition', target: sub.key }, { role: 'parent-species', target: parent.key },
    ] };
    for (const rows of [[parent, base, sub, standard], [standard, sub, base, parent], [parent, base]]) {
      const refs = await buildReferenceIndex({
        get: async (_revision, key) => rows.find(row => row.key === key),
        visit: async (_revision, visitor) => { for (const row of rows) await visitor(row); },
      } as Parameters<typeof buildReferenceIndex>[0], 'r');
      expect(refs.resolve('species', 'Human', 'PHB')).toEqual({ target: rows.includes(standard) ? standard.key : base.key, status: 'resolved' });
      expect(refs.has(base.key)).toBe(true);
    }
  });
  it('keeps unrelated species collisions ambiguous and preserves named variant references', () => {
    const refs = index();
    refs.alias('species', 'Human', 'PHB', 'base');
    refs.standardSpeciesAlias('Human', 'PHB', 'standard', 'base');
    refs.alias('species', 'Human (Variant)', 'PHB', 'variant');
    expect(refs.resolve('species', 'Human (Variant)', 'PHB')).toEqual({ target: 'variant', status: 'resolved' });
    refs.alias('species', 'Human', 'PHB', 'unrelated');
    expect(refs.resolve('species', 'Human', 'PHB').status).toBe('ambiguous');
    const competing = index();
    competing.alias('species', 'Human', 'PHB', 'base');
    competing.standardSpeciesAlias('Human', 'PHB', 'standard-a', 'base');
    competing.standardSpeciesAlias('Human', 'PHB', 'standard-b', 'base');
    expect(competing.resolve('species', 'Human', 'PHB').status).toBe('ambiguous');
  });
  it('uses the requested recipe edition to disambiguate generated weapons while retaining both bases', () => {
    const variants = ['DMG', 'XDMG'].map(source => record('magicvariant', 'Weapon +1', {
      source, requires: [{ weapon: true }], inherits: { source, namePrefix: '+1 ' },
    }));
    const bases = ['PHB', 'XPHB'].map(source => record('baseitem', 'Lance', { source, weapon: true }));
    const generated = variants.flatMap(variant => bases.map(base => generateVariant(base, variant)));
    const refs = index(...generated);
    const holder = record('item', 'Ivory Goats', { source: 'XDMG', entries: ['{@item +1 Lance|XDMG}', '{@item +1 Lance|DMG}'] });
    const result = linkContent(holder, refs);
    expect(result.diagnostics).toEqual([]);
    expect(result.links.map(link => link.target)).toEqual([
      generated.find(item => item.publication === 'XDMG:XPHB')!.key,
      generated.find(item => item.publication === 'DMG:PHB')!.key,
    ]);
    expect(refs.has(generated.find(item => item.publication === 'XDMG:PHB')!.key)).toBe(true);
    const fallback = index(generated.find(item => item.publication === 'XDMG:PHB')!);
    expect(linkContent(holder, fallback).links[0].status).toBe('resolved');
  });
  it('uses revised implicit defaults for later publications and falls back without rewriting explicit sources', () => {
    const oldSpell = record('spell', 'Light');
    const newSpell = record('spell', 'Light', { source: 'XPHB' });
    const holder = record('feat', 'Gift', { source: 'XMM', entries: ['{@spell Light}', '{@spell Light|PHB}'] });
    expect(linkContent(holder, index(oldSpell, newSpell)).links.map(link => link.target)).toEqual([newSpell.key, oldSpell.key]);
    expect(linkContent(holder, index(oldSpell)).links.every(link => link.target === oldSpell.key && link.status === 'resolved')).toBe(true);
    const classic = { ...holder, data: { ...holder.data, edition: 'classic' } };
    expect(linkContent(classic, index(oldSpell, newSpell)).links.every(link => link.target === oldSpell.key)).toBe(true);
  });
  it('keeps ambiguity when multiple candidates belong to the preferred edition', () => {
    expect(referenceEdition('constructor')).toBeUndefined();
    const first = record('item', '+1 Lance', { source: 'XDMG:A', edition: 'one', variantSource: 'XDMG' });
    const second = record('item', '+1 Lance', { source: 'XDMG:B', edition: 'one', variantSource: 'XDMG' });
    for (const item of [first, second]) item.derivation = { operation: 'magicvariant', inputs: [], version: 1 };
    expect(index(first, second).resolve('item', '+1 Lance', 'XDMG').status).toBe('ambiguous');
  });
  it('separates fixed grants, choices, expanded lists and deferred queries with their paths', () => {
    const spell = record('spell', 'Light', { source: 'XPHB' });
    const feat = record('feat', 'Gift', { additionalSpells: [{
      innate: { '1': { daily: { '1': ['Light|XPHB#c'] } } },
      known: { '1': [{ choose: { from: ['Light|XPHB', 'Shield|XPHB'], count: 1 } }, { choose: 'level=0' }] },
      expanded: { '1': ['Light|XPHB'] },
    }] });
    const result = linkContent(feat, index(spell, record('spell', 'Shield', { source: 'XPHB' })));
    expect(result.diagnostics).toEqual([]);
    expect(result.links.find(l => l.role === 'spell-grant')).toMatchObject({ target: spell.key, scope: 'rule', status: 'resolved', path: 'additionalSpells[0].innate.1.daily.1[0]' });
    expect(result.links.find(l => l.role === 'spell-choice')).toMatchObject({ scope: 'catalog', target: spell.key });
    expect(result.links.find(l => l.role === 'spell-expanded')).toMatchObject({ scope: 'catalog', target: spell.key });
    expect(result.links.find(l => l.role === 'spell-selection')).toMatchObject({ status: 'deferred', required: false });
  });
  it('does not substitute editions; missing grants fail while missing descriptions warn', () => {
    const feat = record('feat', 'Gift', { attachedSpells: ['Light|XPHB'], entries: [{ type: 'table', rows: [['{@spell Light|XPHB|label}']] }] });
    const result = linkContent(feat, index(record('spell', 'Light')));
    expect(result.diagnostics.map(d => d.severity)).toEqual(['error', 'warning']);
    expect(result.links.every(l => l.status === 'missing')).toBe(true);
  });
  it('links item groups to generic variants and preserves ambiguous generated aliases', () => {
    const variant = record('magicvariant', 'Weapon +1', { source: 'DMG' });
    const group = record('itemGroup', 'Weapons', { source: 'DMG', items: ['Weapon +1'] });
    expect(linkContent(group, index(variant)).links[0]).toMatchObject({ target: variant.key, scope: 'catalog', status: 'resolved' });
    const refs = index();
    refs.alias('item', '+1 Sword', 'DMG', 'old-sword'); refs.alias('item', '+1 Sword', 'DMG', 'new-sword');
    expect(linkContent(record('feat', 'Gift', { entries: ['{@item +1 Sword}'] }), refs).links[0].status).toBe('ambiguous');
  });
  it('accepts null removed grants and rejects malformed grants', () => {
    expect(linkContent(record('feat', 'Gift', { additionalSpells: null }), index()).links).toEqual([]);
    expect(() => linkContent(record('feat', 'Gift', { additionalSpells: {} }), index())).toThrow('Invalid additionalSpells');
  });
  it('links structured feature entries using parent and level qualifiers', () => {
    const feature = record('classFeature', 'Gift', { className: 'Mage', classSource: 'PHB', level: 1 });
    const holder = record('feat', 'Holder', { entries: [{ type: 'refClassFeature', classFeature: 'Gift|Mage|PHB|1' }] });
    expect(linkContent(holder, index(feature)).links[0]).toMatchObject({ target: feature.key, scope: 'description', status: 'resolved' });
  });
  it('resolves upstream subrace names to the materialized species', async () => {
    const sub = record('subrace', 'High', { raceName: 'Elf', raceSource: 'PHB' });
    const species = record('species', 'High Elf');
    species.derivation = { operation: 'subrace', version: 1, inputs: [{ role: 'subrace-definition', target: sub.key }] };
    const records = [sub, species];
    const refs = await buildReferenceIndex({
      get: async (_revision, key) => records.find(r => r.key === key),
      visit: async (_revision, visitor) => { for (const r of records) await visitor(r); },
    } as Parameters<typeof buildReferenceIndex>[0], 'r');
    expect(linkContent(record('feat', 'Holder', { entries: ['{@race Elf (High)|PHB}'] }), refs).links[0]).toMatchObject({ target: species.key, status: 'resolved' });
  });
  it('links schema-defined limited groups without granting unsupported mechanics', () => {
    const spell = record('spell', 'Light');
    const source = record('feat', 'Gift', { additionalSpells: [{ innate: { _: { limited: { pb: ['Light'] } } } }] });
    expect(linkContent(source, index(spell)).links).toEqual([expect.objectContaining({
      role: 'spell-grant', target: spell.key, path: 'additionalSpells[0].innate._.limited.pb[0]', status: 'resolved',
    })]);
  });

  it('rebuilds cached deferred queries and references without stale targets', () => {
    const feat = record('feat', 'Gift', { additionalSpells: [{ known: { '1': [{ choose: 'level=0' }] } }],
      entries: ['{@item Alias|DMG}'] });
    const firstIndex = index(); firstIndex.alias('item', 'Alias', 'DMG', 'old-generated');
    const first = linkContent(feat, firstIndex);
    const nextIndex = index(); nextIndex.alias('item', 'Alias', 'DMG', 'new-generated');
    const second = linkContent({ ...feat, links: first.links }, nextIndex);
    expect(second.links.find(link => link.role === 'spell-selection')?.status).toBe('deferred');
    expect(second.links.filter(link => link.role === 'entry-item').map(link => link.target)).toEqual(['new-generated']);
    expect(linkContent({ ...feat, links: second.links }, nextIndex)).toEqual(second);
  });

});
