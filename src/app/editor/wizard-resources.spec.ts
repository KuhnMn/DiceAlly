import { mapContent } from '../content/content-adapter';
import { emptyBasicCharacter } from './basic-info';
import { mergeWizardPrefill, WizardState } from './wizard-prefill';
import { seedResourceImports, wizardResourceColumns, wizardResourceValues } from './wizard-resources';
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
  it('defaults new wizard resources to their own source placement and retains existing resource overrides',()=>{
    const f=fixture();combined(f);
    const sources=[{editorId:'rogue-source',name:'Rogue',isGeneralFeatureSource:true,isSpellcastingSource:false},
      {editorId:'soulknife-source',name:'Soulknife',isGeneralFeatureSource:false,isSpellcastingSource:true}];
    const values=wizardResourceValues(f.sheet,f.state,f.columns,sources);
    expect(values[0].value).toMatchObject({features:false,spells:true});
    const first=mergeWizardPrefill(f.sheet,f.state,values).sheet;
    first.resources![0].features=true;first.resources![0].spells=false;
    expect(wizardResourceValues(first,first.creatorWizard!,f.columns,sources)[0].value).toMatchObject({features:true,spells:false});
  });
  it('never imports columns automatically, offers spell counts as reminders and excludes slot progressions',()=>{
    const f=fixture();
    expect(f.columns.map(column=>column.name)).toEqual(['Cantrips Known','Spells Known','Die Size','Number']);
    expect(f.columns.filter(column=>column.sourceId==='rogue-source').map(column=>column.kind)).toEqual(['note','note']);
    expect(wizardResourceValues(f.sheet,f.state,f.columns)).toEqual([]);
    const count=f.columns.find(column=>column.name==='Number')!;
    f.state.resourceImports={[count.id]:{enabled:true}};
    expect(wizardResourceValues(f.sheet,f.state,f.columns).map(entry=>entry.value)).toEqual([
      expect.objectContaining({mode:'counter',total:4,note:'',recovery:'NONE'}),
    ]);
  });
  it('imports numeric spell counts as display text and updates them with the class level',()=>{
    const records=mapContent({class:[{name:'Wizard',source:'XPHB',classFeatures:[],
      preparedSpellsProgression:Array.from({length:20},(_,level)=>level+4),cantripProgression:Array(20).fill(3),
      classTableGroups:[{colLabels:['Prepared Spells','Cantrips'],rows:Array.from({length:20},(_,level)=>[level+4,3])}],
    }]},'spell-counts.json').records;
    const f=fixture();
    const columns=(level:number)=>wizardResourceColumns(records[0],null,'library','wizard',level,'wizard-source','');
    f.state.resourceImports=Object.fromEntries(columns(1).map(column=>[column.id,{enabled:true}]));
    const first=mergeWizardPrefill(f.sheet,f.state,wizardResourceValues(f.sheet,f.state,columns(1))).sheet;
    expect(first.resources).toEqual([
      expect.objectContaining({name:'Prepared Spells',mode:'note',note:'4',total:0,recovery:'NONE'}),
      expect.objectContaining({name:'Cantrips',mode:'note',note:'3',total:0,recovery:'NONE'}),
    ]);
    const next=mergeWizardPrefill(first,first.creatorWizard!,wizardResourceValues(first,first.creatorWizard!,columns(2))).sheet;
    expect(next.resources![0]).toMatchObject({id:first.resources![0].id,mode:'note',note:'5',total:0});
  });
  it('does not classify unrelated numeric headings by partial spell keywords or matching values',()=>{
    const record=mapContent({class:[{name:'Mage',source:'XPHB',classFeatures:[],cantripProgression:Array(20).fill(2),
      classTableGroups:[{colLabels:['Number','Spell Points','Prepared Spells Uses','Cantrip Uses','Spells Known Bonus'],rows:Array.from({length:20},()=>[2,2,2,2,2])}],
    }]},'numeric-columns.json').records[0];
    const columns=wizardResourceColumns(record,null,'library','mage',1,'mage-source','');
    expect(columns.slice(0,5).map(column=>column.kind)).toEqual(Array(5).fill('counter'));
    expect(columns).toHaveLength(5);
  });
  it('excludes slot counts, slot levels and per-level spell grants from mixed source and generated tables',()=>{
    const record=mapContent({class:[{name:'Warlock',source:'XPHB',classFeatures:[],
      spellsKnownProgressionFixed:Array(20).fill(1),spellsKnownProgressionFixedByLevel:{'1':{'1':2}},
      classTableGroups:[{colLabels:['Invocations','Cantrips','Prepared Spells','{@filter Spell Slots|optionalfeatures}','Slot Level',
        'Spell Slot Level','1st','2nd Level','Spells Learned','Spells Gained per Level','Spell Points'],
        rows:Array.from({length:20},()=>[5,3,7,2,3,3,2,2,1,1,8])},
        {colLabels:['3rd'],rowsSpellProgression:Array.from({length:20},()=>[2])}],
    }]},'warlock-resources.json').records[0];
    const columns=wizardResourceColumns(record,null,'library','warlock',5,'warlock-source','');
    expect(columns.map(column=>column.name)).toEqual(['Invocations','Cantrips','Prepared Spells','Spell Points']);
    // Filtering must retain original column positions in stable resource identities.
    expect(columns.at(-1)!.id).toBe(wizardResourceColumns(record,null,'library','warlock',6,'warlock-source','').at(-1)!.id);
  });
  it('persists numeric type choices through export, reopen, deselection and level changes',()=>{
    const f=fixture(), count=f.columns.find(column=>column.name==='Number')!, cantrips=f.columns.find(column=>column.name==='Cantrips Known')!;
    f.state.resourceImports={[count.id]:{enabled:true,kind:'note'},[cantrips.id]:{enabled:true,kind:'counter'}};
    const first=mergeWizardPrefill(f.sheet,f.state,wizardResourceValues(f.sheet,f.state,f.columns)).sheet;
    expect(first.resources!.find(resource=>resource.id===count.id)).toMatchObject({mode:'note',note:'4',total:0});
    expect(first.resources!.find(resource=>resource.id===cantrips.id)).toMatchObject({mode:'counter',total:2,note:''});
    const restored=portableCharacter(JSON.parse(JSON.stringify(first))), next=fixture(5);
    const state=structuredClone(restored.creatorWizard!);
    seedResourceImports(restored,state,next.columns);
    expect(state.resourceImports).toMatchObject(first.creatorWizard!.resourceImports!);
    expect(wizardResourceValues(restored,state,next.columns).find(entry=>entry.path[1]===count.id)!.value)
      .toMatchObject({mode:'note',note:'6',total:0});
    state.resourceImports![count.id].enabled=false;
    const deselected=mergeWizardPrefill(restored,state,wizardResourceValues(restored,state,next.columns)).sheet;
    expect(deselected.creatorWizard!.resourceImports![count.id]).toMatchObject({enabled:false,kind:'note'});
    const reopened=portableCharacter(JSON.parse(JSON.stringify(deselected)));
    reopened.creatorWizard!.resourceImports![count.id].enabled=true;
    expect(wizardResourceValues(reopened,reopened.creatorWizard!,next.columns).find(entry=>entry.path[1]===count.id)!.value)
      .toMatchObject({mode:'note',note:'6',total:0});
  });
  it('uses chosen kinds for attachments and never creates a counter from dice or attaches a resource to itself',()=>{
    const f=fixture(), count=f.columns.find(column=>column.name==='Number')!, die=f.columns.find(column=>column.name==='Die Size')!;
    f.state.resourceImports={[count.id]:{enabled:true,kind:'note',reminderId:die.id},[die.id]:{enabled:true,kind:'counter'}};
    expect(wizardResourceValues(f.sheet,f.state,f.columns).map(entry=>entry.value)).toEqual([
      expect.objectContaining({id:die.id,mode:'note',note:'D6',total:0}),
      expect.objectContaining({id:count.id,mode:'note',note:'4',total:0}),
    ]);
    f.state.resourceImports[count.id]={enabled:true,kind:'counter',reminderId:count.id};
    expect(wizardResourceValues(f.sheet,f.state,f.columns).find(entry=>entry.path[1]===count.id)!.value)
      .toMatchObject({mode:'counter',total:4,note:''});
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
  it('inherits either custom name when combining and removes the replaced reminder even if renamed',()=>{
    for (const custom of ['Number','Die Size']) {
      const f=fixture();
      f.state.resourceImports=Object.fromEntries(f.columns.filter(column=>column.sourceId==='soulknife-source').map(column=>[column.id,{enabled:true}]));
      const first=mergeWizardPrefill(f.sheet,f.state,wizardResourceValues(f.sheet,f.state,f.columns)).sheet;
      const column=f.columns.find(column=>column.name===custom)!;
      first.resources!.find(resource=>resource.id===column.id)!.name='Psionic Energy Dice';
      const state=structuredClone(first.creatorWizard!);
      seedResourceImports(first,state,f.columns);
      const count=f.columns.find(column=>column.name==='Number')!, die=f.columns.find(column=>column.name==='Die Size')!;
      state.resourceImports![count.id].reminderId=die.id;
      const result=mergeWizardPrefill(first,state,wizardResourceValues(first,state,f.columns)).sheet;
      expect(result.resources).toEqual([expect.objectContaining({id:count.id,name:'Psionic Energy Dice',mode:'both',total:4,note:'D6'})]);
    }
  });
  it('prefers the counter name if both resources have custom names and preserves an active reminder tracker',()=>{
    const f=fixture();
    f.state.resourceImports=Object.fromEntries(f.columns.filter(column=>column.sourceId==='soulknife-source').map(column=>[column.id,{enabled:true}]));
    const first=mergeWizardPrefill(f.sheet,f.state,wizardResourceValues(f.sheet,f.state,f.columns)).sheet;
    const count=f.columns.find(column=>column.name==='Number')!, die=f.columns.find(column=>column.name==='Die Size')!;
    Object.assign(first.resources!.find(resource=>resource.id===count.id)!,{name:'Counter name'});
    Object.assign(first.resources!.find(resource=>resource.id===die.id)!,{name:'Reminder name',mode:'both',total:4,used:1});
    const state=structuredClone(first.creatorWizard!);seedResourceImports(first,state,f.columns);
    state.resourceImports![count.id].reminderId=die.id;
    const result=mergeWizardPrefill(first,state,wizardResourceValues(first,state,f.columns)).sheet;
    expect(result.resources!.find(resource=>resource.id===count.id)!.name).toBe('Counter name');
    expect(result.resources!.find(resource=>resource.id===die.id)!.used).toBe(1);
  });
  it('prefills editor settings and replaces selected definitions while preserving spent uses and links',()=>{
    const f=fixture(), first=mergeWizardPrefill(f.sheet,f.state,combined(f)).sheet;
    Object.assign(first.resources![0],{name:'My Psi Dice',recovery:'SHORT_REST',features:false,spells:true,used:2});
    first.features=[{name:'Blade',resourceLinks:[{resourceId:first.resources![0].id,amount:1}]}];
    const next=fixture(5);combined(next);
    seedResourceImports(first,next.state,next.columns);
    const result=mergeWizardPrefill(first,next.state,wizardResourceValues(first,next.state,next.columns)).sheet;
    expect(result.resources![0]).toMatchObject({name:'My Psi Dice',recovery:'SHORT_REST',features:false,spells:true,used:2,total:6,note:'D8'});
    expect(result.features).toEqual(first.features);
    result.resources![0].total=9;
    const advanced=fixture(11);combined(advanced);
    seedResourceImports(result,advanced.state,advanced.columns);
    expect(mergeWizardPrefill(result,advanced.state,wizardResourceValues(result,advanced.state,advanced.columns)).sheet.resources![0].total).toBe(6);
  });
  it('restores selected resources after deletion and keeps referenced pools when their import is deselected',()=>{
    const f=fixture(), values=combined(f);
    const first=mergeWizardPrefill(f.sheet,f.state,values).sheet;
    const removed=structuredClone(first);removed.resources=[];
    expect(mergeWizardPrefill(removed,removed.creatorWizard!,values).sheet.resources).toEqual(first.resources);
    const disabled=structuredClone(removed.creatorWizard!);
    Object.values(disabled.resourceImports!).forEach(setting=>setting.enabled=false);
    expect(mergeWizardPrefill(removed,disabled,wizardResourceValues(removed,disabled,f.columns)).sheet.resources).toEqual([]);
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
  it('round-trips mappings and replaces selected resources with old history too',()=>{
    const f=fixture();combined(f);
    const count=f.columns.find(column=>column.kind==='counter' && column.name==='Number')!;
    f.state.resourceImports![count.id].recovery='SHORT_REST';
    const first=mergeWizardPrefill(f.sheet,f.state,wizardResourceValues(f.sheet,f.state,f.columns)).sheet;
    const restored=portableCharacter(JSON.parse(JSON.stringify(first)));
    expect(restored.creatorWizard!.resourceImports).toEqual(f.state.resourceImports);
    expect(readWizardBookkeeping(restored.creatorWizard!).baseline).toEqual(first.creatorWizard!.baseline);
    const invalid = structuredClone(restored);
    Object.assign(Object.values(invalid.creatorWizard!.resourceImports!)[0], {enabled:'yes'});
    expect(()=>portableCharacter(invalid)).toThrow('Invalid resource import mapping');
    const invalidRecovery=structuredClone(restored);
    invalidRecovery.creatorWizard!.resourceImports![count.id].recovery='UNSUPPORTED';
    expect(()=>portableCharacter(invalidRecovery)).toThrow('Invalid resource import mapping');
    const invalidKind=structuredClone(restored);
    Object.assign(invalidKind.creatorWizard!.resourceImports![count.id],{kind:'unsupported'});
    expect(()=>portableCharacter(invalidKind)).toThrow('Invalid resource import mapping');
    delete first.creatorWizard!.baseline[0].fieldFingerprints;
    first.resources![0].name='Legacy custom name';
    const next=fixture(5);combined(next);
    seedResourceImports(first,next.state,next.columns);
    const result=mergeWizardPrefill(first,next.state,wizardResourceValues(first,next.state,next.columns)).sheet;
    expect(result.resources![0]).toMatchObject({name:'Legacy custom name',total:6,note:'D8'});
    expect(result.creatorWizard!.baseline[0].fieldFingerprints).toBeDefined();
  });
});
