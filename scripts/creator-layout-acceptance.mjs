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
    c.character.featureSources = [{name:'WizardWithAnExtremelyLongCastingSourceNameWithoutSpaces',isGeneralFeatureSource:true,isSpellcastingSource:true,useSpellbook:true,usesIntelligence:true}];
    c.character.hitDice = [{dieType:'d8',total:5,used:0}];
    c.character.spellSlots = {[c.character.featureSources[0].name]:[{level:1,total:3,used:0,regainCondition:'SHORT_REST_ONE'}]};
    c.setPage(2); ng.applyChanges(c);
    const other = ng.getComponent(document.querySelector('app-other-proficiencies'));
    other.languageInput='AReallyLongCustomLanguageNameWithoutAnySpaces'; other.addLanguage(); other.addAdvantage();
    c.setPage(4); ng.applyChanges(c);
    const feature = ng.getComponent(document.querySelector('app-editor-features'));
    feature.customName='AFeatureWithAVeryLongNameWithoutAnySpacesToTestWrapping'; feature.addCustom();
    feature.addNote(c.sheet.features[0]); feature.setNoteEntry(c.sheet.features[0].notes[0],0,'ALongNoteEntryWithoutAnySpacesThatShouldWrapInsideItsCard'); feature.addUses(c.sheet.features[0]);
    const spell = ng.getComponent(document.querySelector('app-editor-spells'));
    spell.customName='ASpellWithAVeryLongNameWithoutAnySpacesToTestWrapping'; spell.addCustom();
    spell.addToList(c.sheet.spells[0],'PREPARED'); spell.list='PREPARED'; spell.toggle(c.sheet.spells[1]);
    c.sheet.spells[1].notes=[{tag:'Notes',notes:['ALongSpellNoteWithoutSpacesThatShouldWrap'],isEditable:true}];
    c.sheet.spells[1].uses=[{tag:'Daily',totalFreeUses:1,usedFreeUses:0,freeUsesRegainCondition:'LONG_REST'}];
    ng.applyChanges(c);`);
  for (const width of [320, 390, 768, 1100]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<500}, session);
    for (const theme of ['light-mc','dark-mc']) {
      await evaluate(session, `ng.getComponent(document.querySelector('app-root')).themeService.currentTheme.set('${theme}');`);
      for (let page=0;page<5;page++) {
        await check(`${width}px ${theme} page ${page}: no horizontal overflow`, async () => {
          await evaluate(session, `c.setPage(${page}); ng.applyChanges(c);`); await delay(150);
          const geometry = await evaluate(session, `({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth, offenders:Array.from(document.querySelectorAll('main *')).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).slice(0,5).map(e=>e.tagName+'.'+e.className)})`);
          assert(geometry.scroll<=geometry.width+1, JSON.stringify(geometry));
          if (page <= 3) {
            const overlaps = await evaluate(session, `Array.from(document.querySelectorAll('${page === 2 ? '.proficiency-layout li' : '.stat-stepper'}')).flatMap(row => {
              const children=Array.from(row.children); const bounds=row.getBoundingClientRect();
              return children.flatMap((child,index)=>{const r=child.getBoundingClientRect();const next=children[index+1]?.getBoundingClientRect();
                return r.right>bounds.right+1 || (next && r.right>next.left+1) || child.scrollWidth>child.clientWidth+1 ? [row.textContent.trim()] : [];});
            })`);
            assert.deepEqual(overlaps, [], 'Controls or proficiency text overlap: '+JSON.stringify(overlaps));
          }
          if (width === 320 && theme === 'light-mc' && (page === 1 || page === 2)) {
            const screenshot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true}, session);
            await writeFile(`.angular/creator-mobile-${page}.png`, Buffer.from(screenshot.data,'base64'));
          }
        });
      }
      for (const selector of ['app-editor-features','app-editor-spells']) {
        await check(`${width}px ${theme} ${selector}: catalog fits and closes`, async () => {
          await evaluate(session, `ng.getComponent(document.querySelector('${selector}')).openCatalog(); ng.applyChanges(c);`); await delay(150);
          const geometry=await evaluate(session, `Array.from(document.querySelectorAll('[role=dialog], .catalog-body')).map(e=>({width:e.clientWidth,scroll:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))`);
          for(const box of geometry) assert(box.scroll<=box.width+1&&box.left>=-1&&box.right<=width+1,JSON.stringify(geometry));
          await evaluate(session, `document.querySelector('[role=dialog]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`); await delay(50);
          assert.equal(await evaluate(session, `!!document.querySelector('[role=dialog]')`),false);
        });
      }
    }
  }
  await send('Emulation.setDeviceMetricsOverride', {width:1100,height:1000,deviceScaleFactor:1,mobile:false},session);
  await evaluate(session, `c.setPage(2); ng.applyChanges(c);`); await delay(200);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},session);
  await writeFile('.angular/creator-layout-preview.png',Buffer.from(screenshot.data,'base64'));
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/creator-layout-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
