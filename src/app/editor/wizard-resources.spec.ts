import { mapContent } from '../content/content-adapter';
import { emptyBasicCharacter } from './basic-info';
import { mergeWizardPrefill, WizardState } from './wizard-prefill';
import { wizardResourceColumns, wizardResourceValues } from './wizard-resources';
import { SourceResource } from '../models/source-resources';
import { portableCharacter } from '../characters/portable-character';
import { readWizardBookkeeping } from './wizard-bookkeeping';

function fixture(level = 3) {
  const records = mapContent({ class: [{ name: 'Rogue', source: 'XPHB', classFeatures: [],
    cantripProgression: Array(20).fill(2), spellsKnownProgression: Array(20).fill(3),
    classTableGroups: [{ colLabels: ['Cantrips Known'], rows: Array.from({length:20},()=>[2]) },
      { colLabels: ['1st'], rowsSpellProgression: Array.from({length:20},()=>[2]) }],
  }], subclass: [{ name: 'Soulknife', shortName: 'Soulknife', source: 'XPHB', className: 'Rogue', classSource: 'XPHB', subclassFeatures: [],
    subclassTableGroups: [{ colLabels: ['Die Size','Number'], rows: Array.from({length:20},(_,index)=>[index < 4 ? '{@dice D6}' : '{@dice D8}',index < 4 ? 4 : 6]) }] }],
  }, 'resources.json').records;
  const parent = records.find(record=>record.kind==='class')!, subclass = records.find(record=>record.kind==='subclass')!;
  const columns = wizardResourceColumns(parent,subclass,'library','rogue',level,'rogue-source','soulknife-source');
  const state: WizardState = {revisionId:'revision',classes:[],answers:{},options:{resourceReminders:true},baseline:[],protectedPaths:[]};
  const sheet=emptyBasicCharacter();
  return {parent,subclass,columns,state,sheet};
}
function combined(f: ReturnType<typeof fixture>) {
  const count=f.columns.find(column=>column.name==='Number')!, die=f.columns.find(column=>column.name==='Die Size')!;
  f.state.resourceImports = {[count.id]:{enabled:true,name:'Psionic Energy',reminderId:die.id},[die.id]:{enabled:true}};
  return wizardResourceValues(f.sheet,f.state,f.columns);
}
describe('Explicit resource imports',()=>{
  it('never imports free-form numeric columns automatically and excludes schema spell and slot progressions',()=>{
    const f=fixture();
    expect(f.columns.map(column=>column.name)).toEqual(['Cantrips Known','Die Size','Number']);
    expect(wizardResourceValues(f.sheet,f.state,f.columns)).toEqual([]);
    const count=f.columns.find(column=>column.name==='Number')!;
    f.state.resourceImports={[count.id]:{enabled:true}};
    expect(wizardResourceValues(f.sheet,f.state,f.columns).map(entry=>entry.value)).toEqual([
      expect.objectContaining({mode:'counter',total:4,note:'',recovery:'NONE'}),
    ]);
  });
  it('combines only explicitly associated values, keeps the counter identity and follows levels',()=>{
    const f=fixture(), values=combined(f);
    expect(values).toHaveLength(1);
    const first=values[0].value as SourceResource;
    expect(first).toMatchObject({name:'Psionic Energy',mode:'both',total:4,note:'D6'});
    const next=fixture(5);combined(next);
    const resource=wizardResourceValues(next.sheet,next.state,next.columns)[0].value as SourceResource;
    expect(resource).toMatchObject({id:first.id,total:6,note:'D8',sourceId:'soulknife-source'});
    next.state.resourceImports![resource.id].reminderId=next.columns.find(column=>column.name==='Cantrips Known')!.id;
    expect((wizardResourceValues(next.sheet,next.state,next.columns).find(entry=>entry.path[1]===resource.id)!.value as SourceResource).mode).toBe('counter');
  });
  it('updates untouched fields after manual renaming, recovery and placement changes while preserving spent uses and links',()=>{
    const f=fixture(), first=mergeWizardPrefill(f.sheet,f.state,combined(f)).sheet;
    Object.assign(first.resources![0],{name:'My Psi Dice',recovery:'SHORT_REST',features:false,spells:true,used:2});
    first.features=[{name:'Blade',resourceLinks:[{resourceId:first.resources![0].id,amount:1}]}];
    const next=fixture(5);combined(next);
    const result=mergeWizardPrefill(first,first.creatorWizard!,wizardResourceValues(first,next.state,next.columns)).sheet;
    expect(result.resources![0]).toMatchObject({name:'My Psi Dice',recovery:'SHORT_REST',features:false,spells:true,used:2,total:6,note:'D8'});
    expect(result.features).toEqual(first.features);
    result.resources![0].total=9;
    const advanced=fixture(11);combined(advanced);
    expect(mergeWizardPrefill(result,result.creatorWizard!,wizardResourceValues(result,advanced.state,advanced.columns)).sheet.resources![0].total).toBe(9);
  });
  it('preserves removed resources and keeps referenced pools when their import is deselected',()=>{
    const f=fixture(), values=combined(f);
    const first=mergeWizardPrefill(f.sheet,f.state,values).sheet;
    const removed=structuredClone(first);removed.resources=[];
    expect(mergeWizardPrefill(removed,removed.creatorWizard!,values).sheet.resources).toEqual([]);
    first.spells=[{name:'Spell',resourceLinks:[{resourceId:first.resources![0].id,amount:1}]}];
    expect(mergeWizardPrefill(first,first.creatorWizard!,[]).sheet.resources).toEqual(first.resources);
  });
  it('applies an explicitly edited mapping without replacing unrelated manual fields',()=>{
    const f=fixture(), first=mergeWizardPrefill(f.sheet,f.state,combined(f)).sheet;
    const resource=first.resources![0];
    Object.assign(resource,{name:'Manual name',note:'Manual reminder',recovery:'LONG_REST',used:2});
    const state=structuredClone(first.creatorWizard!);
    state.resourceImports![resource.id]={enabled:true,name:'New chosen name',reminderId:''};
    const result=mergeWizardPrefill(first,state,wizardResourceValues(first,state,f.columns)).sheet.resources![0];
    expect(result).toMatchObject({name:'New chosen name',mode:'counter',note:'',recovery:'LONG_REST',total:4,used:2});
  });
  it('round-trips mappings and field history and handles old edited history conservatively',()=>{
    const f=fixture(), first=mergeWizardPrefill(f.sheet,f.state,combined(f)).sheet;
    const restored=portableCharacter(JSON.parse(JSON.stringify(first)));
    expect(restored.creatorWizard!.resourceImports).toEqual(f.state.resourceImports);
    expect(readWizardBookkeeping(restored.creatorWizard!).baseline).toEqual(first.creatorWizard!.baseline);
    const invalid = structuredClone(restored);
    Object.assign(Object.values(invalid.creatorWizard!.resourceImports!)[0], {enabled:'yes'});
    expect(()=>portableCharacter(invalid)).toThrow('Invalid resource import mapping');
    delete first.creatorWizard!.baseline[0].fieldFingerprints;
    first.resources![0].name='Legacy custom name';
    const next=fixture(5);combined(next);
    const result=mergeWizardPrefill(first,first.creatorWizard!,wizardResourceValues(first,next.state,next.columns)).sheet;
    expect(result.resources![0]).toEqual(first.resources![0]);
    expect(result.creatorWizard!.baseline[0].fieldFingerprints).toBeDefined();
  });
});
