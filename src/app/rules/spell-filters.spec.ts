import { mapContent } from '../content/content-adapter';
import { filterSpells } from './spell-filters';
describe('Audited spell filters', () => {
  const records = mapContent({ spell: [
    { name: 'A',source: 'TEST',level: 1,school: 'A',meta: { ritual: true },classes: { fromClassList: [{ name: 'Wizard', source: 'TEST' }] } },
    { name: 'B',source: 'TEST',level: 0,school: 'V',spellAttack: ['R'],classes: { fromClassListVariant: [{ name: 'Bard', source: 'TEST' }] } },
    { name: 'C',source: 'OTHER',level: 1,school: 'N',classes: { fromClassList: [{ name: 'Cleric', source: 'TEST' }] } },
  ] },'synthetic.json').records;
  const index = new Map(records.map(r => [r.key,r]));
  it('combines clauses with AND and values with OR, ignoring case', () => {
    expect(filterSpells('level=0;1|class=wizard;bard|source=test',index).map(r => r.name)).toEqual(['A','B']);
    expect(filterSpells('school=A|components & miscellaneous=RITUAL',index).map(r => r.name)).toEqual(['A']);
    expect(filterSpells('spell attack=m;r;o',index).map(r => r.name)).toEqual(['B']);
    expect(filterSpells('',index)).toHaveLength(3);
  });
  it('rejects unsupported fields/operators and malformed values', () => {
    for (const query of ['level=[1;3]','class=!Wizard','unknown=yes','level=10','level=','source=TEST=meta','components & miscellaneous=concentration']) {
      expect(() => filterSpells(query,index)).toThrow();
    }
  });
});
