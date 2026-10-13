import { buildReferenceIndex, ContentReferenceIndex, linkContent } from './content-linker';
import { ContentRecord, entityKey, JsonObject } from './content.model';

function record(kind: string, name: string, data: JsonObject = {}): ContentRecord {
  const raw = { name, source: 'PHB', ...data };
  return { kind, name, data: raw, key: entityKey(kind, raw), publication: String(raw.source), file: 'test.json', links: [] };
}
function index(...records: ContentRecord[]) {
  const result = new ContentReferenceIndex(); records.forEach(r => result.add(r)); return result;
}
describe('Content reference linking', () => {
  it('separates fixed grants, choices, expanded lists and deferred queries with their paths', () => {
    const spell = record('spell', 'Light', { source: 'XPHB' });
    const feat = record('feat', 'Gift', { additionalSpells: [{
      innate: { '1': { daily: { '1': ['Light|XPHB#c'] } } },
      known: { '1': [{ choose: { from: ['Light|XPHB'], count: 1 } }, { choose: 'level=0' }] },
      expanded: { '1': ['Light|XPHB'] },
    }] });
    const result = linkContent(feat, index(spell));
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
    expect(() => linkContent(record('feat', 'Gift', { additionalSpells: {} }), index())).toThrow('additionalSpells must be an array');
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
});
