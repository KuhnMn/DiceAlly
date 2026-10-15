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
  while (Date.now() - start < 30000) {
    try { const result = await work(); if (result) return result; }
    catch (error) {
      // SSR markup can arrive before Angular's development API during a full reload.
      if (!error.message.includes('ng is not defined')) throw error;
    }
    await delay(100);
  }
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
const report={checks:[]};
async function check(name,work){await work();report.checks.push({name,passed:true});console.log('PASS '+name);}
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

  await evaluate(session, "globalThis.c = ng.getComponent(document.querySelector('app-local-editor')); c.character.name='Integration hero'; c.character.maxHp=24; c.character.currentHp=12; c.sheet.notes=[{id:1,title:'Session',body:'Preserve me'}]; c.character.hitDice=[{dieType:'d8',total:3,used:1}];");
  const id=await evaluate(session, "c.character.characterUuid");
  await check('Creator Save & View opens the saved-ID sheet',async()=>{
    await evaluate(session,"c.viewSheet()");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    assert.equal(await evaluate(session,"location.pathname"),'/characters/'+id);
  });
  await check('Viewer edits round trip into creator',async()=>{
    await evaluate(session,"globalThis.v=ng.getComponent(document.querySelector('app-character-sheet')); v.characterData().character.currentHp=7; v.characterData().notes[0].body='Played session'; v.editCharacter()");
    await until(()=>evaluate(session,"!!document.querySelector('app-local-editor')"));
    assert.equal(await evaluate(session,"location.pathname"),'/characters/'+id+'/edit');
    const saved=await evaluate(session,"(()=>{globalThis.c=ng.getComponent(document.querySelector('app-local-editor'));return {hp:c.character.currentHp,notes:c.sheet.notes,dice:c.character.hitDice};})()");
    assert.equal(saved.hp,7);assert.equal(saved.notes[0].body,'Played session');assert.equal(saved.dice[0].used,1);
  });
  await check('Editor URL reload rehydrates the same character',async()=>{
    await evaluate(session,'globalThis.reloadMarker = true');
    await send('Page.reload',{},session);
    await until(()=>evaluate(session,"!globalThis.reloadMarker && !!globalThis.ng && !!document.querySelector('app-local-editor') && ng.getComponent(document.querySelector('app-local-editor')).character.name==='Integration hero'"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-local-editor')).character.currentHp"),7);
  });
  await check('Library lists creator saves and full export reads canonical data',async()=>{
    await evaluate(session,"ng.getComponent(document.querySelector('app-local-editor')).router.navigate(['/'])");
    await until(()=>evaluate(session,"!!document.querySelector('app-import') && ng.getComponent(document.querySelector('app-import')).savedCharacters().length>0"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-import')).savedCharacters()[0].characterId"),id);
    await evaluate(session,"ng.getComponent(document.querySelector('app-import')).downloadCharacter("+JSON.stringify(id)+")");
    await until(()=>evaluate(session,"!!document.querySelector('app-export-options-modal') && !!ng.getComponent(document.querySelector('app-export-options-modal')).character()"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-export-options-modal')).character().notes[0].body"),'Played session');
    await evaluate(session,"ng.getComponent(document.querySelector('app-import')).closeExportModal()");
  });
  await check('Saved sheet URL reload works without in-memory state',async()=>{
    await send('Page.navigate',{url:origin+'/characters/'+id},session);
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet') && !!ng.getComponent(document.querySelector('app-character-sheet')).characterData()"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).characterData().character.currentHp"),7);
  });

  await check('Imported viewer JSON can be edited under its original ID',async()=>{
    await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).router.navigate(['/'])");
    await until(()=>evaluate(session,"!!document.querySelector('app-import')"));
    await evaluate(session,"(()=>{const page=ng.getComponent(document.querySelector('app-import'));page.raw=JSON.stringify({installationId:'android-import',character:{characterUuid:'android-test',name:'Android hero',maxHpOverride:31,armorClassOverride:16,currentHp:9},notes:[{id:3,title:'Imported',body:'Original data'}]});return page.loadFromText();})()");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    assert.equal(await evaluate(session,"location.pathname"),'/characters/android-test');
    await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).editCharacter()");
    await until(()=>evaluate(session,"!!document.querySelector('app-local-editor')"));
    assert.equal(await evaluate(session,"location.pathname"),'/characters/android-test/edit');
    const values=await evaluate(session,"(()=>{const editor=ng.getComponent(document.querySelector('app-local-editor'));return {hp:editor.character.maxHp,ac:editor.character.armorClass,current:editor.character.currentHp,notes:editor.sheet.notes};})()");
    assert.equal(values.hp,31);assert.equal(values.ac,16);assert.equal(values.current,9);assert.equal(values.notes[0].body,'Original data');
    await evaluate(session,"ng.getComponent(document.querySelector('app-local-editor')).viewSheet()");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).characterData().installationId"),'android-import');
  });

  await check('Optional unsupported wizard history cannot hide saved characters or block the sheet',async()=>{
    await evaluate(session,"(()=>{const viewer=ng.getComponent(document.querySelector('app-character-sheet'));const sheet=structuredClone(viewer.characterData());sheet.character.characterUuid='history-isolation';sheet.character.name='History Isolation';sheet.creatorWizard={baseline:{old:{value:1}},protectedKeys:[]};return viewer.library.save(sheet,0);})()");
    await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).router.navigate(['/'])");
    await until(()=>evaluate(session,"!!document.querySelector('app-import') && ng.getComponent(document.querySelector('app-import')).savedCharacters().some(entry=>entry.characterId==='history-isolation')"));
    await evaluate(session,"ng.getComponent(document.querySelector('app-import')).loadCharacter('history-isolation')");
    await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
    assert.equal(await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).characterData().character.name"),'History Isolation');
  });

  await check('Character deletion uses the shared themed dialog and respects Cancel',async()=>{
    await evaluate(session,"ng.getComponent(document.querySelector('app-character-sheet')).router.navigate(['/'])");
    await until(()=>evaluate(session,"!!document.querySelector('app-import') && ng.getComponent(document.querySelector('app-import')).savedCharacters().some(entry=>entry.characterId==='android-test')"));
    await evaluate(session,"globalThis.libraryPage=ng.getComponent(document.querySelector('app-import'));libraryPage.requestDeleteCharacter(libraryPage.savedCharacters().find(entry=>entry.characterId==='android-test'))");
    await until(()=>evaluate(session,"!!document.querySelector('app-remove-entry-dialog [role=alertdialog]')"));
    assert.match(await evaluate(session,"document.querySelector('app-remove-entry-dialog').textContent"),/Android hero/);
    await evaluate(session,"document.querySelector('app-remove-entry-dialog .secondary-button').click()");
    await until(()=>evaluate(session,"!document.querySelector('app-remove-entry-dialog')"));
    assert.equal(await evaluate(session,"!!(await libraryPage.library.get('android-test'))"),true);
    await evaluate(session,"libraryPage.requestDeleteCharacter(libraryPage.savedCharacters().find(entry=>entry.characterId==='android-test'))");
    await until(()=>evaluate(session,"!!document.querySelector('app-remove-entry-dialog .remove-button')"));
    await evaluate(session,"document.querySelector('app-remove-entry-dialog .remove-button').click()");
    await until(()=>evaluate(session,"!libraryPage.deleting() && !libraryPage.savedCharacters().some(entry=>entry.characterId==='android-test')"));
    assert.equal(await evaluate(session,"!!(await libraryPage.library.get('android-test'))"),false);
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/creator-viewer-integration-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
