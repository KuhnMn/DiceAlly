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

  const { targetId } = await send('Target.createTarget', {url:origin});
  const { sessionId: session } = await send('Target.attachToTarget', {targetId,flatten:true});
  await until(()=>evaluate(session,"!!globalThis.ng && !!document.querySelector('app-import')"));
  await evaluate(session,"globalThis.themeService=ng.getComponent(document.querySelector('app-import')).themeService");
  await check('Game data link is grouped with Create Character',async()=>{
    assert.equal(await until(()=>evaluate(session,"!!document.querySelector('nav[aria-label=\"Character library actions\"] a[href=\"/content\"]')")),true);
    await evaluate(session,"document.querySelector('a[href=\"/content\"]').click()");
    await until(()=>evaluate(session,"!!document.querySelector('app-content-import')"));
    assert.equal(await evaluate(session,"location.pathname"),'/content');
  });
  for(const width of [320,390,1000]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<640},session);
    await check('Import layout fits '+width+'px',async()=>{
      await evaluate(session,"document.querySelector('app-content-import details').open=true");
      await delay(100);
      const layout=await evaluate(session,"({width:innerWidth,scroll:document.documentElement.scrollWidth,fields:[...document.querySelectorAll('app-content-import input:not([type=file])')].map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))})");
      assert(layout.scroll<=layout.width+1,JSON.stringify(layout));
      assert(layout.fields.every(r=>r.left>=0&&r.right<=width+1),JSON.stringify(layout));
    });
  }

  await check('Status bar stays visible while scrolling on mobile',async()=>{
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:600,deviceScaleFactor:1,mobile:true},session);
    await evaluate(session,"globalThis.importer=ng.getComponent(document.querySelector('app-content-import')); importer.importing.set(true); importer.busy.set(true); importer.progress.set({phase:'download',completed:3,total:12,records:100,bytes:1024,file:'spells/AReallyLongFilenameThatShouldNotOverflowTheStatusBar.json'});ng.applyChanges(importer);scrollTo(0,450)");
    await delay(100);
    const box=await evaluate(session,"(()=>{const bar=document.querySelector('.import-status-bar');const r=bar.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,scroll:document.documentElement.scrollWidth,width:innerWidth,value:bar.querySelector('progress').value};})()");
    assert(box.top>=0&&box.top<20,JSON.stringify(box));
    assert(box.right<=321&&box.scroll<=box.width+1,JSON.stringify(box));
    assert.equal(box.value,3);
    await evaluate(session,"importer.importing.set(false);importer.busy.set(false);importer.progress.set(null);ng.applyChanges(importer);scrollTo(0,0)");
    assert.equal(await evaluate(session,"!!document.querySelector('.import-status-bar')"),true);
  });
  await check('Theme colors reach inputs and action buttons',async()=>{
    const colors=[];
    for(const theme of ['light-mc','dark-mc']){
      await evaluate(session,"themeService.setTheme("+JSON.stringify(theme)+")");
      await delay(100);
      colors.push(await evaluate(session,"getComputedStyle(document.querySelector('.action-button')).backgroundColor"));
    }
    assert(colors.every(color=>color!=='rgba(0, 0, 0, 0)'));
    assert.notEqual(colors[0],colors[1]);
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/content-import-layout-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
