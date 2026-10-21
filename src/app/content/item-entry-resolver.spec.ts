import { mapContent } from './content-adapter';
import { entityKey } from './content.model';
import { resolveItemEntries } from './item-entry-resolver';
import { itemRuleEntries } from './item-resolver';

const templates = (entries: unknown[]) => new Map(mapContent({ itemEntry: entries }, 'items-base.json').records.map(record => [record.key, record]));

describe('Item entry templates', () => {
  it('resolves property-name tokens alongside item fields in core property templates', () => {
    const records = mapContent({ itemProperty: [
      { name: 'Finesse', abbreviation: 'F', source: 'PHB', template: '{{prop_name_lower}}' },
      { name: 'Two-Handed', abbreviation: '2H', source: 'XPHB', template: '{{prop_name}} / {{prop_name_lower}}' },
      { name: 'Ammunition', abbreviation: 'A', source: 'XPHB', template: '{{prop_name}} (Range {{item.range}}; {{item.ammoType}})' },
    ] }, 'items-base.json').records;
    expect(itemRuleEntries(records[0], {})).toEqual(['finesse']);
    expect(itemRuleEntries(records[1], {})).toEqual(['Two\u2011Handed / two\u2011handed']);
    expect(itemRuleEntries(records[2], { range: '80/320', ammoType: 'Arrow|XPHB' })).toEqual(['Ammunition (Range 80/320; Arrow|XPHB)']);
  });
  it('keeps static property details usable when a presentation template is unsupported', () => {
    const definition = mapContent({ itemProperty: [{ name: 'Custom', source: 'TEST', abbreviation: 'C',
      template: '{{unsupported_token}}', entries: ['Authored description'] }] }, 'homebrew/custom.json').records[0];
    expect(itemRuleEntries(definition, {})).toEqual(['Authored description', 'Some details for this property could not be displayed.']);
    expect(definition.data['template']).toBe('{{unsupported_token}}');
  });
  it('expands exact source references, nested entries, item properties and the resistance formatter', () => {
    const definitions = templates([
      { name: 'Resistance', source: 'DMG', entriesTemplate: ['Classic {{item.resist}}.'] },
      { name: 'Resistance', source: 'XDMG', entriesTemplate: [{ type: 'entries', name: '{{item.detail1}}', entries: ['Resist {{getFullImmRes item.resist}}.', '{#itemEntry Shared|TEST}'] }] },
      { name: 'Shared', source: 'TEST', entriesTemplate: ['Shared text.'] },
    ]);
    const item = { detail1: 'Ruby', resist: ['fire'], entries: ['Before', '{#itemEntry Resistance|XDMG}', '{#itemEntry Resistance}', 'After'] };
    const original = structuredClone(item);
    const result = resolveItemEntries(item, definitions);
    expect(result.entries).toEqual(['Before', { type: 'entries', name: 'Ruby', entries: ['Resist fire.', 'Shared text.'] }, 'Classic fire.', 'After']);
    expect(result.links.map(link => link.target)).toEqual(['Resistance|XDMG', 'Shared|TEST', 'Resistance|DMG'].map(uid => {
      const [name, source] = uid.split('|'); return entityKey('itemEntry', { name, source });
    }));
    expect(item).toEqual(original);
    expect(definitions.get(entityKey('itemEntry', { name: 'Resistance', source: 'XDMG' }))!.data['entriesTemplate']).toEqual([
      { type: 'entries', name: '{{item.detail1}}', entries: ['Resist {{getFullImmRes item.resist}}.', '{#itemEntry Shared|TEST}'] },
    ]);
  });
  it('formats conditional resistance groups without losing their notes', () => {
    const definitions = templates([{ name: 'Resistance', source: 'DMG', entriesTemplate: ['{{getFullImmRes item.resist}}'] }]);
    expect(resolveItemEntries({ resist: ['fire', { resist: ['cold', 'lightning'], preNote: 'against', note: 'while worn' }],
      entries: ['{#itemEntry Resistance}'] }, definitions).entries).toEqual(['fire; against cold and lightning while worn']);
  });
  it('rejects missing definitions, cycles and missing template properties', () => {
    const item = { entries: ['{#itemEntry Resistance}'] };
    expect(() => resolveItemEntries(item, templates([]))).toThrow('Missing itemEntry definition');
    expect(() => resolveItemEntries(item, templates([{ name: 'Resistance', source: 'DMG', entriesTemplate: ['{#itemEntry Resistance}'] }]))).toThrow('Cyclic itemEntry');
    expect(() => resolveItemEntries(item, templates([{ name: 'Resistance', source: 'DMG', entriesTemplate: ['{{item.resist}}'] }]))).toThrow('Unresolved item template property');
  });
});
