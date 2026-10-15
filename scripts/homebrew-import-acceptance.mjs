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
  while (Date.now() - start < 180000) { const result = await work(); if (result) return result; await delay(100); }
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
  const { targetId } = await send('Target.createTarget', { url: `${origin}/content` });
  const { sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true });
  await until(()=>evaluate(session, `!!globalThis.ng && !!document.querySelector('app-content-import') && !ng.getComponent(document.querySelector('app-content-import')).busy()`));
  await evaluate(session, `globalThis.i=ng.getComponent(document.querySelector('app-content-import'));
    const source=i.source;const identity=JSON.stringify(['github',source.owner,source.repository,source.directory]);
    const revision={id:'homebrew-core-fixture',namespace:'development-local',source,sourceIdentity:identity,commit:'a'.repeat(40),adapterVersion:7,status:'ready',createdAt:new Date().toISOString(),files:['fixture-core.json'],diagnostics:[],metrics:{bytes:0,records:1,mappedBytes:0,elapsedMs:0}};
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ally-content-v1',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(['records','revisions','active','settings'],'readwrite');
      tx.objectStore('revisions').put(revision);tx.objectStore('settings').put({namespace:'development-local',source});
      tx.objectStore('active').put({key:JSON.stringify(['development-local',identity,'main']),revisionId:revision.id});
      tx.objectStore('records').put({revisionId:revision.id,key:JSON.stringify(['spell','core spell','phb']),kind:'spell',name:'Core Spell',publication:'PHB',file:'fixture-core.json',links:[],data:{name:'Core Spell',source:'PHB',level:1}});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();`);
  const dom=await send('DOM.getDocument',{},session);
  const input=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#homebrew-upload'},session);
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.resolve('.angular/valda-homebrew.json')]},session);
  await check('imports the actual Valda collection through the upload UI and worker while retaining core content',async()=>{
    await evaluate(session,`i.startHomebrew('file');`);
    await until(()=>evaluate(session,`!i.busy()`));
    const result=await evaluate(session,`({message:i.message(),errors:i.diagnostics().filter(d=>d.severity==='error').slice(0,8),revision:i.revision()?.id,files:i.revision()?.homebrewFiles?.length,count:i.revision()?.metrics.records})`);
    assert.equal(result.errors.length,0,JSON.stringify(result));assert.match(result.message,/Homebrew file imported/);assert.equal(result.files,1);assert(result.count>2000);
    const spells=await evaluate(session,`await i.cache.category(i.revision().id,'spell',1000)`);
    assert(spells.some(spell=>spell.name==='Core Spell'));
    const lifesteal=spells.find(spell=>spell.name==='Minor Lifesteal');assert(lifesteal);
    assert(lifesteal.data.classes.fromClassList.some(entry=>entry.name==='Wizard'));
    console.log('Imported records:',result.count,'; dependency warnings:',await evaluate(session,'i.diagnostics().length'));
  });
  await check('reimport is idempotent and malformed files leave the active library intact',async()=>{
    const previous=await evaluate(session,'i.revision().id');
    await evaluate(session,`i.startHomebrew('file');`);await until(()=>evaluate(session,`!i.busy()`));
    assert.equal(await evaluate(session,'i.revision().id'),previous);
    await evaluate(session, `i.homebrewUrl="https://raw.githubusercontent.com/TheGiddyLimit/homebrew/refs/heads/master/collection/Mage%20Hand%20Press%3B%20Valda's%20Spire%20of%20Secrets%20-%202024.json";i.startHomebrew('url');`);
    await until(()=>evaluate(session, `!i.busy()`));
    assert.match(await evaluate(session,'i.message()'),/Homebrew file imported/);
    assert.equal(await evaluate(session,'i.revision().id'),previous);
    console.log('PASS importing the same collection by URL creates no duplicate installation');
    await evaluate(session,`i.homebrewFile=new File(['{"spell":"invalid"}'],'invalid.json',{type:'application/json'});i.startHomebrew('file');`);
    await until(()=>evaluate(session,`!i.busy()`));
    assert.match(await evaluate(session,'i.message()'),/must be an array/);
    assert.equal(await evaluate(session,'i.revision().id'),previous);
  });
  for(const width of [320,390,1100])await check(`${width}px homebrew controls fit`,async()=>{
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},session);
    const geometry=await evaluate(session,`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})`);
    assert(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));
  });
  await check('homebrew spell filters and copied spells remain available in the creator',async()=>{
    await send('Page.navigate',{url:`${origin}/characters/new`},session);
    await until(()=>evaluate(session,`!!document.querySelector('app-local-editor')`));
    await evaluate(session,`globalThis.c=ng.getComponent(document.querySelector('app-local-editor'));c.setPage(4);ng.applyChanges(c);`);
    await until(()=>evaluate(session,`!!document.querySelector('app-editor-spells') && !ng.getComponent(document.querySelector('app-editor-spells')).loading()`));
    await evaluate(session,`globalThis.s=ng.getComponent(document.querySelector('app-editor-spells'));await s.refreshContent();s.filter.search='Minor Lifesteal';s.filter.classes=['Wizard'];await s.searchContent();`);
    assert.equal(await evaluate(session,'s.results().length'),1);
    await evaluate(session,`s.add(s.results()[0]);c.character.name='Homebrew Browser Test';await c.save();`);
    assert.equal(await evaluate(session,'c.error()'),'');
    assert.equal(await evaluate(session,'c.sheet.spells[0].name'),'Minor Lifesteal');
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/homebrew-import-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
