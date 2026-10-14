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
  const { targetId } = await send('Target.createTarget', { url: `${origin}/dev/characters` });
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
    await evaluate(session, `w.advance();ng.applyChanges(w);const choice=w.proposal().choices.find(choice=>choice.label==='skill proficiencies');w.toggleChoice(choice,'arcana');w.advance();ng.applyChanges(w);`);
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
    await evaluate(session,`c.open(c.entries().find(entry=>entry.id===c.character.characterUuid));ng.applyChanges(c);`);
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
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/class-wizard-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
