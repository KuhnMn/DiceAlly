import { mapContent } from '../content/content-adapter';
import { deriveProficiencyGrants } from './proficiency-rules';
function fixture(skills: unknown,language?: unknown,tools?: unknown) {
  const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',startingProficiencies: { skills,tools } }],
    baseitem: [{ name: 'Kit',source: 'TEST' }] },'synthetic.json').records;
  records.push({ key: 'species',kind: 'species',name: 'People',publication: 'TEST',file: 'synthetic',links: [],data: { languageProficiencies: language } });
  return { selections: [{ selectionId: 'mage',classKey: records.find(r => r.kind === 'class')!.key,level: 1 }],
    index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) } };
}
describe('General proficiency choice pools', () => {
  it('expands any-skill choices, excludes fixed grants and validates distinct eligible answers', () => {
    const f = fixture([{ any: 2,perception: true }]);
    const pending = deriveProficiencyGrants(f.selections,f.index); const choice = pending.choices[0];
    expect(pending.canAccept).toBe(false); expect(choice.candidates).toHaveLength(17); expect(choice.candidates).not.toContain('perception');
    const selected = deriveProficiencyGrants(f.selections,f.index,{ [choice.id]: ['arcana','history'] });
    expect(selected.canAccept).toBe(true); expect(selected.generated.map(c => c.target)).toEqual(['perception','arcana','history']);
    expect(deriveProficiencyGrants(f.selections,f.index,{ [choice.id]: ['arcana','arcana'] }).canAccept).toBe(false);
  });
  it('uses explicit language catalogs and rejects missing catalogs and already granted languages', () => {
    const f = fixture(undefined,[{ common: true,anyStandard: 1 }]);
    expect(deriveProficiencyGrants(f.selections,f.index,{},'species').canAccept).toBe(false);
    const catalogs = { language: { anyStandard: ['common','elvish','dwarvish'] } };
    const pending = deriveProficiencyGrants(f.selections,f.index,{},'species',[],catalogs); const choice = pending.choices[0];
    expect(choice.candidates).toEqual(['elvish','dwarvish']);
    const selected = deriveProficiencyGrants(f.selections,f.index,{ [choice.id]: ['elvish'] },'species',[],catalogs);
    expect(selected.canAccept).toBe(true); expect(selected.generated.map(c => c.target)).toEqual(['common','elvish']);
  });
  it('resolves exact tagged tool items but refuses descriptive choices, alternatives and publication fallback', () => {
    const exact = fixture(undefined,undefined,['{@item Kit|TEST}']);
    expect(deriveProficiencyGrants(exact.selections,exact.index).generated[0].target).toBe('["baseitem","kit","test"]');
    const missing = fixture(undefined,undefined,['{@item Kit|OTHER}']); expect(deriveProficiencyGrants(missing.selections,missing.index).canAccept).toBe(false);
    const description = fixture(undefined,undefined,['Choose one musical instrument']); expect(deriveProficiencyGrants(description.selections,description.index).canAccept).toBe(false);
    const alternatives = fixture(undefined,[{ common: true },{ elvish: true }]); expect(deriveProficiencyGrants(alternatives.selections,alternatives.index,{},'species').canAccept).toBe(false);
  });
  it('requires exactly one package and grants only that alternative, preserving manual contributions', () => {
    const f = fixture(undefined,[{ common: true },{ elvish: true }]);
    const pending = deriveProficiencyGrants(f.selections,f.index,{},'species'); const pkg = pending.packages[0];
    expect(pending.generated).toEqual([]); expect(pkg.options.map(o => o.value)).toEqual(['0','1']);
    const manual = [{ kind: 'language' as const,target: 'dwarvish',origin: 'manual',rank: 1 as const }];
    const selected = deriveProficiencyGrants(f.selections,f.index,{ [pkg.id]: ['1'] },'species',manual);
    expect(selected.canAccept).toBe(true); expect(selected.generated.map(c => c.target)).toEqual(['elvish']);
    expect(selected.manual).toEqual(manual);
    expect(deriveProficiencyGrants(f.selections,f.index,{ [pkg.id]: ['0','1'] },'species').canAccept).toBe(false);
    expect(deriveProficiencyGrants(f.selections,f.index,{ [pkg.id]: ['01'] },'species').canAccept).toBe(false);
    pkg.options[1].data['elvish'] = false;
    expect(deriveProficiencyGrants(f.selections,f.index,{ [pkg.id]: ['1'] },'species').canAccept).toBe(true);
  });
  it('keeps nested choices separate by package and does not reuse another package answer', () => {
    const f = fixture([{ arcana: true,any: 1 },{ history: true,any: 1 }]);
    const pkg = deriveProficiencyGrants(f.selections,f.index).packages[0];
    const firstAnswers = { [pkg.id]: ['0'] };
    const first = deriveProficiencyGrants(f.selections,f.index,firstAnswers); const choice = first.choices[0];
    expect(first.canAccept).toBe(false); expect(choice.candidates).not.toContain('arcana');
    const answered = { ...firstAnswers,[choice.id]: ['perception'] };
    expect(deriveProficiencyGrants(f.selections,f.index,answered).canAccept).toBe(true);
    const switched = deriveProficiencyGrants(f.selections,f.index,{ ...answered,[pkg.id]: ['1'] });
    expect(switched.canAccept).toBe(false); expect(switched.choices[0].id).not.toBe(choice.id);
    expect(switched.generated.map(c => c.target)).toEqual(['history']);
    expect(deriveProficiencyGrants(f.selections,f.index,answered).generated.map(c => c.target)).toEqual(['arcana','perception']);
  });
});
