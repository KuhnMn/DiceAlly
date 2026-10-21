import { contentEntries, SourceEntries } from './content-entries';
import { sourceProficiencyGrants } from './proficiency-grants';
import { attachedSpells } from './attached-spells';
import { ContentReferenceIndex, linkContent } from './content-linker';
import { ContentRecord, entityKey, JsonObject } from './content.model';

function record(kind: string, name: string, data: JsonObject = {}): ContentRecord {
  return { kind, key: entityKey(kind, { name, source: 'TEST' }), name, publication: 'TEST', file: 'fixture.json', links: [], data };
}
describe('Shared source payload contracts', () => {
  it('validates species proficiency packages without inventing fixed ranks or choice fields', () => {
    const species = record('species', 'People', { skillProficiencies: [{ perception: true }, { choose: { from: ['arcana', 'history'], count: 1 } }] });
    expect(sourceProficiencyGrants(species).skills).toEqual(species.data['skillProficiencies']);
    expect(() => sourceProficiencyGrants(record('species', 'People', { skillProficiencies: [{ perception: 2 }] }))).toThrow('Invalid proficiency grants');
    expect(() => sourceProficiencyGrants(record('species', 'People', { toolProficiencies: ['Choose any tool'] }))).toThrow('Invalid proficiency grants');
    expect(() => sourceProficiencyGrants(record('species', 'People', { languageProficiencies: [{ choose: { from: ['common', 'elvish'], guessed: true } }] }))).toThrow();
  });
  it('links both attached-spell profiles with exact publications, usage paths and no metadata references', () => {
    const spell = record('spell', 'Light'); const index = new ContentReferenceIndex(); index.add(spell);
    const grouped = record('item', 'Wand', { attachedSpells: {
      ability: { choose: ['int', 'wis'] }, resourceName: 'Focus',
      daily: { '2e': ['Light|TEST'] }, rest: { '1': ['Light|TEST'] }, limited: { '1': ['Light|TEST'] },
      charges: { '3': ['Light|TEST'] }, resource: { '2': ['Light|TEST'] },
      will: ['Light|TEST'], ritual: ['Light|TEST'], other: ['Light|TEST'],
    } });
    const before = structuredClone(grouped);
    const result = linkContent(grouped, index);
    expect(result.diagnostics).toEqual([]);
    expect(result.links.map(link => link.path)).toEqual([
      'attachedSpells.daily.2e[0]', 'attachedSpells.rest.1[0]', 'attachedSpells.limited.1[0]',
      'attachedSpells.charges.3[0]', 'attachedSpells.resource.2[0]', 'attachedSpells.will[0]',
      'attachedSpells.ritual[0]', 'attachedSpells.other[0]',
    ]);
    expect(result.links.every(link => link.target === spell.key && link.scope === 'rule')).toBe(true);
    expect(grouped).toEqual(before);
    expect(linkContent(record('item', 'Wand', { attachedSpells: ['Light|TEST'] }), index).links[0].path).toBe('attachedSpells[0]');
    expect(linkContent(record('item', 'Wand', { attachedSpells: { will: ['Light|OTHER'] } }), index).diagnostics[0].severity).toBe('error');
    expect(() => attachedSpells(record('item', 'Wand', { attachedSpells: [{ spell: 'Light|TEST' }] }))).toThrow();
  });
  it('keeps nested source entries, table cells and higher-level references intact', () => {
    const entries: SourceEntries = [{ type: 'table', rows: [[0, '{@spell Light|TEST}'], { type: 'row', row: ['Keep'] }] }];
    const source = record('spell', 'Description', { entries, entriesHigherLevel: [{ type: 'entries', entries: ['{@spell Light|TEST}'] }] });
    const before = structuredClone(source);
    const index = new ContentReferenceIndex(); index.add(record('spell', 'Light'));
    expect(contentEntries(source)).toEqual(entries);
    expect(linkContent(source, index).links.map(link => link.path)).toEqual(['entries[0].rows[0][1]', 'entriesHigherLevel[0].entries[0]']);
    expect(source).toEqual(before);
    expect(() => contentEntries(record('feat', 'Bad', { entries: 'Not an array' }))).toThrow();
  });
  it('links standalone table and nested group descriptions to conditions and variant rules', () => {
    const condition = record('condition', 'Prone'); const rule = record('variantrule', 'Flanking');
    const spell = record('spell', 'Light');
    const index = new ContentReferenceIndex(); [condition, rule, spell].forEach(value => index.add(value));
    const table = record('table', 'Outcomes', { type: 'tableGroup',
      caption: '{@variantrule Flanking|TEST}', colLabels: ['Result'],
      rows: [['{@condition Prone|TEST}']],
      footnotes: ['{@condition Missing|TEST}'],
      tables: [{ type: 'table', rows: [['{@spell Light|TEST}']] }],
    });
    const before = structuredClone(table);
    const result = linkContent(table, index);
    expect(result.links.map(link => link.path)).toEqual(['caption', 'rows[0][0]', 'footnotes[0]', 'tables[0].rows[0][0]']);
    expect(result.links.filter(link => link.status === 'resolved').map(link => link.target)).toEqual([rule.key, condition.key, spell.key]);
    expect(result.links.every(link => link.scope === 'description' && !link.required)).toBe(true);
    expect(result.diagnostics.map(issue => issue.severity)).toEqual(['warning']);
    expect(table).toEqual(before);
  });

});
