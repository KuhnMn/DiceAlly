import { mapContent } from './content-adapter';
import { entityKey } from './content.model';
import { resolveItemEntries } from './item-entry-resolver';

const templates = (entries: unknown[]) => new Map(mapContent({ itemEntry: entries }, 'items-base.json').records.map(record => [record.key, record]));

describe('Item entry templates', () => {
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
