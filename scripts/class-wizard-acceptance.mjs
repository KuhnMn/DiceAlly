// Run against ng serve on port 4201. Uses an isolated profile; requires no content download.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = process.env.ALLY_ORIGIN ?? 'http://127.0.0.1:4201';
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(temporaryRoot, 'ally-basic-info-'));
const chrome = spawn(process.env.ALLY_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let launchError; chrome.on('error', e => launchError = e); chrome.stderr.on('data', () => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(work) {
  const start = Date.now();
  while (Date.now() - start < 30000) { const result = await work(); if (result) return result; await delay(100); }
  throw new Error('Browser readiness timed out.');
}
let socket; let nextId = 0; const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(session, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
const report = { checks: [], limitations: ['Headless Chrome viewport checks; physical-device acceptance remains deferred.'] };
async function check(name, work) { await work(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
try {
  const port = await until(async () => {
    if (launchError) throw launchError;
    try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; }
  });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data); const entry = pending.get(message.id); if (!entry) return;
    clearTimeout(entry.timer); pending.delete(message.id);
    message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
  });
  const { targetId } = await send('Target.createTarget', { url: `${origin}/characters/new` });
  const { sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true });
  await until(() => evaluate(session, `!!globalThis.ng && !!document.querySelector('app-local-editor')`));
  await evaluate(session, `globalThis.c = ng.getComponent(document.querySelector('app-local-editor'));
    globalThis.input = (selector, value) => { const field = document.querySelector(selector); if(!field) throw new Error('Missing input '+selector);
      field.value = value; field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); };`);

  await evaluate(session, `
    const source={owner:'wizard-browser-test',repository:'content',branch:'main',directory:'data'};
    const identity=JSON.stringify(['github',source.owner,source.repository,source.directory]);
    const revision={id:'wizard-browser-revision',namespace:'development-local',source,sourceIdentity:identity,commit:'e'.repeat(40),adapterVersion:7,status:'ready',createdAt:new Date().toISOString(),files:[],diagnostics:[],metrics:{bytes:0,records:7,elapsedMs:0,mappedBytes:0}};
    globalThis.classKey=JSON.stringify(['class','wizard','test']); globalThis.subKey=JSON.stringify(['subclass','school','test','wizard','test','school']);
    const definitions=[
      ['class',classKey,{name:'Wizard',source:'TEST',hd:{number:1,faces:6},casterProgression:'full',spellcastingAbility:'int',classFeatures:['Gift|Wizard|TEST|1','Greater Gift|Wizard|TEST|3'],proficiency:['int','wis'],startingProficiencies:{weapons:['simple'],skills:[{choose:{from:['arcana','history'],count:1}}]}}],
      ['subclass',subKey,{name:'School',shortName:'School',source:'TEST',className:'Wizard',classSource:'TEST',subclassFeatures:['School Gift|Wizard|TEST|School|TEST|3'],additionalSpells:[{ability:'int',innate:{'3':{daily:{'1':['Shield|TEST']}}}}]}],
      ['classFeature',JSON.stringify(['classFeature','gift','test','wizard','test',1]),{name:'Gift',source:'TEST',className:'Wizard',classSource:'TEST',level:1,entries:['Gift text']}],
      ['classFeature',JSON.stringify(['classFeature','greater gift','test','wizard','test',3]),{name:'Greater Gift',source:'TEST',className:'Wizard',classSource:'TEST',level:3}],
      ['subclassFeature',JSON.stringify(['subclassFeature','school gift','test','wizard','test','school','test',3]),{name:'School Gift',source:'TEST',className:'Wizard',classSource:'TEST',subclassShortName:'School',subclassSource:'TEST',level:3}],
      ['spell',JSON.stringify(['spell','shield','test']),{name:'Shield',source:'TEST',level:1,school:'A',entries:['Shield text'],classes:{fromClassList:[{name:'Wizard',source:'TEST'}]}}],
      ['spell',JSON.stringify(['spell','spark','test']),{name:'Spark',source:'TEST',level:0,school:'V',entries:['Spark text'],classes:{fromClassList:[{name:'Wizard',source:'TEST'}]}}]
    ];
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('ally-content-v1',3);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['records','revisions','active','settings'],'readwrite');
      tx.objectStore('revisions').put(revision);tx.objectStore('settings').put({namespace:'development-local',source});
      tx.objectStore('active').put({key:JSON.stringify(['development-local',identity,'main']),revisionId:revision.id});
      for(const [kind,key,data] of definitions)tx.objectStore('records').put({revisionId:revision.id,kind,key,name:data.name,publication:'TEST',file:'fixture.json',data,links:[]});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    Array.from(document.querySelectorAll('header button')).find(button=>button.textContent.trim()==='Class Wizard').click();`);
  await until(()=>evaluate(session,`!!document.querySelector('app-class-wizard') && !ng.getComponent(document.querySelector('app-class-wizard')).loading()`));
  assert.equal(await evaluate(session, `ng.getComponent(document.querySelector('app-class-wizard')).error()`), '');
  await evaluate(session, `globalThis.w=ng.getComponent(document.querySelector('app-class-wizard'));w.addClass();ng.applyChanges(w);`);
  await until(() => evaluate(session, `!!document.querySelector('#wizard-class-0')`));
  await evaluate(session, `document.querySelector('#wizard-class-0 button').click();ng.applyChanges(w);Array.from(document.querySelectorAll('#wizard-class-0 [role=option]')).find(button=>button.dataset.value===classKey).click();ng.applyChanges(w);`);
  await until(() => evaluate(session, `!!document.querySelector('#wizard-subclass-0')`));
  await evaluate(session, `input('#wizard-level-0','3');document.querySelector('#wizard-subclass-0 button').click();ng.applyChanges(w);Array.from(document.querySelectorAll('#wizard-subclass-0 [role=option]')).find(button=>button.dataset.value===subKey).click();ng.applyChanges(w);`);
  await check('class selection, exact subclass and skill choices produce a review',async()=>{
    await evaluate(session, `w.advance();ng.applyChanges(w);const choice=w.proposal().choices.find(choice=>choice.label.endsWith(': skill proficiencies'));w.toggleChoice(choice,'arcana');w.advance();ng.applyChanges(w);`);
    assert.equal(await evaluate(session,'w.stage'),2); assert.deepEqual(await evaluate(session,'w.proposal().errors'),[]);
  });
  for(const width of [320,390,768,1100]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},session);
    for(const theme of ['light-mc','dark-mc'])for(const stage of [0,1,2])await check(`${width}px ${theme} wizard step ${stage}: fits`,async()=>{
      await evaluate(session,`ng.getComponent(document.querySelector('app-root')).themeService.currentTheme.set('${theme}');w.stage=${stage};ng.applyChanges(w);`);await delay(100);
      const boxes=await evaluate(session,`Array.from(document.querySelectorAll('[role=dialog],.catalog-body,.catalog-footer')).map(e=>({width:e.clientWidth,scroll:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))`);
      for(const box of boxes)assert(box.scroll<=box.width+1 && box.left>=-1 && box.right<=width+1,JSON.stringify(boxes));
      if(width===320&&theme==='light-mc'&&stage===0){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('.angular/class-wizard-mobile.png',Buffer.from(shot.data,'base64'));}
    });
  }
  await check('apply, save and reopen keep self-contained wizard data',async()=>{
    await evaluate(session,`w.stage=2;w.apply();ng.applyChanges(c);c.character.name='Wizard Browser Test';c.changed();await c.save();`);
    assert.equal(await evaluate(session,'c.error()'),'');
    assert.equal(await evaluate(session,'c.character.level'),3);assert.equal(await evaluate(session,'c.character.maxHp'),14);
    assert.equal(await evaluate(session,'c.sheet.features.length'),3);
    assert.equal(await evaluate(session,`c.sheet.spells.some(spell=>spell.listType==='PREPARED'&&spell.uses.length)`),true);
    await evaluate(session,`c.open(await c.library.get(c.character.characterUuid));ng.applyChanges(c);`);
    assert.equal(await evaluate(session,'c.sheet.creatorWizard.classes[0].level'),3);
  });
  await check('reopening and increasing level preserves manual HP, notes and used hit dice',async()=>{
    await evaluate(session,`c.character.maxHp=99;c.sheet.features[0].notes=[{tag:'Tactics',notes:['Keep this note'],isEditable:false}];c.character.hitDice[0].used=2;c.changed();c.wizardOpen=true;ng.applyChanges(c);`);
    await until(()=>evaluate(session,`!!document.querySelector('app-class-wizard')&&!ng.getComponent(document.querySelector('app-class-wizard')).loading()`));
    await evaluate(session,`globalThis.w=ng.getComponent(document.querySelector('app-class-wizard'));w.state.classes[0].level=4;w.rebuild();w.advance();w.advance();w.apply();ng.applyChanges(c);await c.save();`);
    assert.equal(await evaluate(session,'c.error()'),''); assert.equal(await evaluate(session,'c.character.maxHp'),99);
    assert.equal(await evaluate(session,'c.character.level'),4);assert.equal(await evaluate(session,'c.character.hitDice[0].total'),4);assert.equal(await evaluate(session,'c.character.hitDice[0].used'),2);
    assert.equal(await evaluate(session,'c.sheet.features[0].notes[0].notes[0]'),'Keep this note');
  });

  await check('Bard multiclass proficiency choices identify their source and complete without manual fallback',async()=>{
    await evaluate(session,"c.wizardOpen=true;ng.applyChanges(c)");
    await until(()=>evaluate(session,"!!document.querySelector('app-class-wizard')&&!ng.getComponent(document.querySelector('app-class-wizard')).loading()"));
    await evaluate(session,`globalThis.w=ng.getComponent(document.querySelector('app-class-wizard'));
      const add=(kind,data)=>{const key=JSON.stringify([kind,data.name.toLowerCase(),'test']);w.records.set(key,{key,kind,name:data.name,publication:'TEST',file:'fixture.json',data:{source:'TEST',...data},links:[]});return key;};
      const bard=add('class',{name:'Bard',hd:{number:1,faces:8},casterProgression:'full',spellcastingAbility:'cha',classFeatures:[],multiclassing:{proficienciesGained:{skills:[{choose:{from:['perception','stealth'],count:1}}],tools:['Choose one instrument'],toolProficiencies:[{anyMusicalInstrument:1}]}}});
      add('item',{name:'Lute',type:'INS'});add('item',{name:'Flute',type:'INS'});
      w.state.classes.push({selectionId:'bard',classKey:bard,level:1});w.rebuild();w.stage=1;
      for(const choice of w.proposal().choices.filter(choice=>choice.label.startsWith('Bard:')))w.toggleChoice(choice,choice.candidates[0].value);
      ng.applyChanges(w);`);
    assert.equal(await evaluate(session,"w.proposal().unresolved.length"),0);
    assert.equal(await evaluate(session,"w.proposal().warnings.length"),0);
    assert.equal(await evaluate(session,"w.canReview"),true);
    assert.equal(await evaluate(session,"document.querySelector('app-class-wizard').textContent.includes('Finish manually if needed')"),false);
    const cards=await evaluate(session,"[...document.querySelectorAll('app-class-wizard section')].filter(e=>e.querySelector('h3')?.textContent.startsWith('Bard:')).map(e=>({finished:e.textContent.includes('Finished'),search:!!e.querySelector('input'),enabled:[...e.querySelectorAll('button')].every(b=>!b.disabled)}))");
    assert.equal(cards.length,2);
    assert(cards.every(card=>card.finished&&!card.search&&card.enabled),JSON.stringify(cards));
  });

  await check('Bulk Known spells collapse while individual Prepared grants remain visible',async()=>{
    await evaluate(session,`for(let i=0;i<20;i++){
      const name='Bulk Cantrip '+i;const key=JSON.stringify(['spell',name.toLowerCase(),'test']);
      w.records.set(key,{key,kind:'spell',name,publication:'TEST',file:'fixture.json',links:[],data:{name,source:'TEST',level:0,classes:{fromClassList:[{name:'Wizard',source:'TEST'}]}}});
    }
    const key=JSON.stringify(['spell','mage hand','test']);
    w.records.set(key,{key,kind:'spell',name:'Mage Hand',publication:'TEST',file:'fixture.json',links:[],data:{name:'Mage Hand',source:'TEST',level:0}});
    w.records.get(subKey).data.additionalSpells[0].known={'3':['Mage Hand|TEST']};
    w.state.classes[0].spellList='Wizard';w.rebuild();w.stage=2;ng.applyChanges(w);`);
    const groups=await evaluate(session,"[...document.querySelectorAll('app-class-wizard details')].filter(e=>e.querySelector('summary')?.textContent.includes('Known Cantrips')).map(e=>({open:e.open,label:e.querySelector('summary').textContent,entries:e.querySelectorAll('p').length}))");
    assert(groups.some(group=>!group.open&&group.entries>=20),JSON.stringify(groups));
    assert.equal(await evaluate(session,"w.reviewItems().some(item=>item.label==='Mage Hand: prepared'&&!item.entries)"),true);
    await evaluate(session,"[...document.querySelectorAll('app-class-wizard details')].find(e=>e.querySelector('summary')?.textContent.includes('Known Cantrips')).querySelector('summary').click()");
    assert.equal(await evaluate(session,"[...document.querySelectorAll('app-class-wizard details')].some(e=>e.open&&e.textContent.includes('Bulk Cantrip 0'))"),true);
  });

  await check('Monsters tab adds library companions and preserves HP, uses and grouped notes',async()=>{
    await evaluate(session,"c.wizardOpen=false;c.setPage(5);ng.applyChanges(c)");
    await until(()=>evaluate(session,"!!document.querySelector('app-editor-monsters')&&!ng.getComponent(document.querySelector('app-editor-monsters')).catalog.loading()"));
    await evaluate(session,`globalThis.m=ng.getComponent(document.querySelector('app-editor-monsters'));
      const revision=m.catalog.revision();
      const wolf={key:JSON.stringify(['monster','wolf','test']),kind:'monster',name:'Wolf',publication:'TEST',file:'fixture.json',links:[],data:{name:'Wolf',source:'TEST',type:'beast',hp:{average:11},speed:{walk:40},action:[{name:'Bite',entries:['Bite text']}]}};
      await m.catalog.cache.put(revision.id,[wolf]);m.search='Wolf';await m.catalog.search(m.query());m.openCatalog();ng.applyChanges(m);`);
    await until(()=>evaluate(session,"!!document.querySelector('app-catalog-dialog')"));
    await evaluate(session,"[...document.querySelectorAll('app-catalog-dialog button')].find(b=>b.textContent.trim()==='Add').click()");
    assert.equal(await evaluate(session,"c.sheet.monsters.length"),1);
    await evaluate(session,`m.catalogOpen=false;m.expanded.add(c.sheet.monsters[0]);ng.applyChanges(m);
      const field=document.querySelector('app-editor-monsters input[type=number]');field.value='25';field.dispatchEvent(new Event('input',{bubbles:true}));
      c.sheet.monsters[0].notes=[{tag:'Commands',notes:['Guard','Follow'],isEditable:true}];
      c.sheet.monsters[0].uses=[{tag:'Summon',totalFreeUses:3,usedFreeUses:1,freeUsesRegainCondition:'SHORT_REST_ONE'}];ng.applyChanges(m);await c.save();`);
    assert.equal(await evaluate(session,"c.error()"),'');
    await evaluate(session,"c.open(await c.library.get(c.character.characterUuid));c.setPage(5);ng.applyChanges(c)");
    assert.equal(await evaluate(session,"c.sheet.monsters[0].monsterMaxHP"),25);
    assert.equal(await evaluate(session,"c.sheet.monsters[0].notes[0].notes.length"),2);
    assert.equal(await evaluate(session,"c.sheet.monsters[0].uses[0].usedFreeUses"),1);
    for(const width of [320,390,1100]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},session);
      await evaluate(session,"globalThis.m=ng.getComponent(document.querySelector('app-editor-monsters'));m.expanded.add(c.sheet.monsters[0]);ng.applyChanges(m)");
      const geometry=await evaluate(session,"({width:innerWidth,scroll:document.documentElement.scrollWidth})");
      assert(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));
    }
    await evaluate(session,"await c.viewSheet()");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    await evaluate(session,"globalThis.viewer=ng.getComponent(document.querySelector('app-character-sheet'));viewer.currentPage.set(5);ng.applyChanges(viewer)");
    await until(()=>evaluate(session,"!!document.querySelector('app-monsters-page')"));
    await evaluate(session,"globalThis.monstersPage=ng.getComponent(document.querySelector('app-monsters-page'));monstersPage.toggleExpanded('monster-Wolf');ng.applyChanges(monstersPage)");
    assert.equal(await evaluate(session,"!!document.querySelector('app-monsters-page app-feature-uses')"),true);
    assert.equal(await evaluate(session,"!!document.querySelector('app-monsters-page app-feature-notes')"),true);
  });

  await check('Shared stat blocks render descriptive AC and opt-in HP tracking',async()=>{
    await evaluate(session,"await viewer.editCharacter()");
    await until(()=>evaluate(session,"!!document.querySelector('app-local-editor')"));
    await evaluate(session,"globalThis.c=ng.getComponent(document.querySelector('app-local-editor'));c.setPage(5);ng.applyChanges(c)");
    await until(()=>evaluate(session,"!!document.querySelector('app-editor-monsters')&&!ng.getComponent(document.querySelector('app-editor-monsters')).catalog.loading()"));
    await evaluate(session,`globalThis.m=ng.getComponent(document.querySelector('app-editor-monsters'));
      const beast={key:JSON.stringify(['monster','beast of the land','test']),kind:'monster',name:'Beast of the Land',publication:'TEST',file:'fixture.json',links:[],data:{name:'Beast of the Land',source:'TEST',type:'beast',ac:[{special:'13 plus your Wisdom modifier'}],hp:{special:'5 plus five times your Ranger level'},str:14,dex:14,trait:[{name:'Primal Bond',entries:['Add your Proficiency Bonus to any ability check.']}],action:[{name:"Beast's Strike",entries:['**Melee Attack Roll:** **Bonus Equals Your Spell Attack Modifier**, reach 5 ft.']}] }};
      await m.catalog.cache.put(m.catalog.revision().id,[beast]);m.search='Beast of the Land';await m.catalog.search(m.query());m.openCatalog();ng.applyChanges(m);`);
    await until(()=>evaluate(session,"!!document.querySelector('app-catalog-dialog app-monster-stat-block')"));
    const text=await evaluate(session,"document.querySelector('app-catalog-dialog app-monster-stat-block').textContent");
    assert(text.includes('13 plus your Wisdom modifier')&&text.includes('Primal Bond')&&text.includes("Beast's Strike"),text);
    assert(!text.includes('"entries"')&&!text.includes('**'),text);
    await evaluate(session,"[...document.querySelectorAll('app-catalog-dialog button')].find(b=>b.textContent.trim()==='Add').click();m.catalogOpen=false;m.expanded.add(c.sheet.monsters[1]);ng.applyChanges(m)");
    assert.equal(await evaluate(session,"c.sheet.monsters[1].hpEnabled"),false);
    assert.equal(await evaluate(session,"[...document.querySelectorAll('app-editor-monsters article')].find(e=>e.textContent.includes('Beast of the Land')).querySelector('input[type=number]').value"),'');
    await evaluate(session,"await c.viewSheet()");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    await evaluate(session,"globalThis.viewer=ng.getComponent(document.querySelector('app-character-sheet'));viewer.currentPage.set(5);ng.applyChanges(viewer)");
    await until(()=>evaluate(session,"!!document.querySelector('app-monsters-page')"));
    const displayed=await evaluate(session,"[...document.querySelectorAll('app-monsters-page h3')].find(e=>e.textContent==='Beast of the Land').closest('div.border-2').textContent");
    assert(displayed.includes('13 plus your Wisdom modifier'),displayed);
    assert.equal(await evaluate(session,"viewer.characterData().monsters.find(m=>m.name==='Beast of the Land').hpEnabled"),false);
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/class-wizard-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
