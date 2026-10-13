// Run with the development server on localhost:4201. Uses an isolated Chrome profile.
// Writes measurements/test outcomes only, never compendium or character data.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const origin = 'http://127.0.0.1:4201';
const commit = '8c026b807fac21862a309379a0c3228a0683198b';
const executable = process.env.ALLY_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(temporaryRoot, 'ally-browser-'));
const bundle = await build({ stdin: { contents: `export { IndexedDbContentCache } from './src/app/content/content-cache';
  export { DEFAULT_CONTENT_SOURCE, sourceIdentity } from './src/app/content/content.model';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'browser' });
const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Access-Control-Allow-Origin': '*' }); res.end(bundle.outputFiles[0].text); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const helpers = `http://127.0.0.1:${server.address().port}/helpers.js`;
const chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'],
{ windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let launchError;
chrome.on('error', error => { launchError = error; });
chrome.stderr.on('data', () => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(work, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await work(); if (result) return result; await delay(250); }
  throw new Error(`Timed out after ${timeout} ms`);
}
let socket; const pending = new Map(); let nextId = 0;
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 60000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(session, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function page(browserContextId) {
  const { targetId } = await send('Target.createTarget', { url: `${origin}/dev/content`, ...(browserContextId ? { browserContextId } : {}) });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await until(() => evaluate(sessionId, `!!document.querySelector('app-content-import') && !!globalThis.ng && !ng.getComponent(document.querySelector('app-content-import')).busy()`));
  await evaluate(sessionId, `globalThis.c = ng.getComponent(document.querySelector('app-content-import')); globalThis.h = await import(${JSON.stringify(helpers)});`);
  return { targetId, sessionId };
}
const report = { date: new Date().toISOString(), commit, environment: {}, imports: [], checks: [], limitations: [
  'Headless desktop Chrome, development build; not a physical phone or interactive visual review.',
  'Heap is sampled per JavaScript isolate, not total browser memory or an exact peak.',
  'Cold means a fresh browser profile/cache; upstream or network intermediaries may cache responses.',
] };
async function check(name, work) {
  try { const details = await work(); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
}
async function start(session) {
  await evaluate(session, `c.source.branch = ${JSON.stringify(commit)}; document.querySelector('button[type="submit"]').click();`);
}
async function waitImport(session, label) {
  const started = Date.now(); let lastLog = 0; let workerSession; let mainHeap = 0; let workerHeap = 0;
  await evaluate(session, `globalThis.ticks = []; globalThis.lastTick = performance.now(); globalThis.tickTimer = setInterval(() => {
    const now = performance.now(); ticks.push(now - lastTick); lastTick = now;
  }, 50);`);
  let status;
  for (;;) {
    status = await evaluate(session, `({busy: c.busy(), message: c.message(), progress: c.progress(), revision: c.revision()?.id})`);
    const heap = await send('Runtime.getHeapUsage', {}, session); mainHeap = Math.max(mainHeap, heap.usedSize);
    if (!workerSession) {
      const targets = await send('Target.getTargets');
      const worker = targets.targetInfos.find(t => t.type === 'worker' && t.url.startsWith(origin));
      if (worker) workerSession = (await send('Target.attachToTarget', { targetId: worker.targetId, flatten: true })).sessionId;
    }
    if (workerSession) {
      try { workerHeap = Math.max(workerHeap, (await send('Runtime.getHeapUsage', {}, workerSession)).usedSize); } catch { workerSession = undefined; }
    }
    if (Date.now() - lastLog > 5000) { console.log(JSON.stringify({ label, elapsedSeconds: Math.round((Date.now() - started) / 1000), ...status })); lastLog = Date.now(); }
    if (!status.busy) break;
    if (Date.now() - started > 600000) throw new Error('Import exceeded ten minutes');
    await delay(1000);
  }
  const ticks = await evaluate(session, `clearInterval(tickTimer); ticks.sort((a,b)=>a-b); ({samples: ticks.length, maximumMs: Math.max(0,...ticks), p95Ms: ticks[Math.floor(ticks.length * .95)] ?? 0})`);
  assert.match(status.message, /Content imported/);
  const revision = await evaluate(session, `({id: c.revision().id, metrics: c.revision().metrics, warnings: c.revision().diagnostics.length})`);
  const storage = await send('Storage.getUsageAndQuota', { origin });
  const result = { label, elapsedMs: Date.now() - started, ...revision, storage, sampledMainHeapBytes: mainHeap, sampledWorkerHeapBytes: workerHeap, mainThreadTimer: ticks };
  report.imports.push(result); return result;
}
try {
  const port = await until(async () => {
    if (launchError) throw launchError;
    try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; }
  });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  report.environment = { browser: version.Browser, platform: process.platform, node: process.version, build: 'development', viewport: '1280x800', disposableProfile: true };
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data); const entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  };
  const main = await page();
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, main.sessionId);
  await check('cold full import through Angular UI and real worker', async () => { await start(main.sessionId); return waitImport(main.sessionId, 'cold desktop'); });
  const firstId = report.imports[0].id;
  await check('browse classes, species and items', async () => {
    for (const kind of ['class', 'species', 'item']) {
      const count = await evaluate(main.sessionId, `c.browseKind = ${JSON.stringify(kind)}; await c.browse(c.revision().id); c.records().length`);
      assert(count > 0, `${kind} empty`);
    }
  });
  await check('live import is protected from a competing tab; cancellation retains active content', async () => {
    await start(main.sessionId);
    await until(() => evaluate(main.sessionId, `c.busy() && c.progress()?.phase === 'download' && c.progress().records > 0`));
    const competitor = await page();
    assert.match(await evaluate(competitor.sessionId, 'c.message()'), /another tab/);
    await send('Target.closeTarget', { targetId: competitor.targetId });
    await evaluate(main.sessionId, 'c.cancel()');
    await until(() => evaluate(main.sessionId, '!c.busy()'));
    assert.equal(await evaluate(main.sessionId, 'c.revision().id'), firstId);
    assert.match(await evaluate(main.sessionId, 'c.message()'), /cancelled/);
    assert.equal(await evaluate(main.sessionId, `(await c.cache.revisions('development-local')).filter(e => e.revision.status === 'staging').length`), 0);
  });
  await check('closed-tab import recovers on reopen', async () => {
    const interrupted = await page(); await start(interrupted.sessionId);
    await until(() => evaluate(interrupted.sessionId, `c.progress()?.phase === 'download' && c.progress().records > 0`));
    await send('Target.closeTarget', { targetId: interrupted.targetId });
    await until(() => evaluate(main.sessionId, `(await navigator.locks.query()).held.length === 0`));
    const reopened = await page();
    assert.match(await evaluate(reopened.sessionId, 'c.message()'), /Removed .*interrupted/);
    assert.equal(await evaluate(reopened.sessionId, `(await c.cache.revisions('development-local')).filter(e => e.revision.status === 'staging').length`), 0);
    assert.equal(await evaluate(reopened.sessionId, 'c.revision().id'), firstId);
    await send('Target.closeTarget', { targetId: reopened.targetId });
  });
  await check('second full import', async () => { await start(main.sessionId); return waitImport(main.sessionId, 'warm desktop'); });
  const secondId = report.imports[1].id;
  await check('inactive deletion, active protection and reload', async () => {
    await evaluate(main.sessionId, `localStorage.setItem('acceptance-character-sentinel', 'preserved'); await c.refreshStorage(); await c.removeRevision(${JSON.stringify(firstId)});`);
    assert.equal(await evaluate(main.sessionId, `(await c.cache.revisions('development-local')).length`), 1);
    const guarded = await evaluate(main.sessionId, `try { await c.cache.deleteRevision('development-local', ${JSON.stringify(secondId)}); false; } catch { true; }`);
    assert(guarded);
    await send('Page.reload', {}, main.sessionId);
    await until(() => evaluate(main.sessionId, `!!document.querySelector('app-content-import') && !ng.getComponent(document.querySelector('app-content-import')).busy()`));
    await evaluate(main.sessionId, `globalThis.c = ng.getComponent(document.querySelector('app-content-import'));`);
    assert.equal(await evaluate(main.sessionId, 'c.revision().id'), secondId);
    assert.equal(await evaluate(main.sessionId, `localStorage.getItem('acceptance-character-sentinel')`), 'preserved');
    await evaluate(main.sessionId, 'await c.browse(c.revision().id)');
    assert(await evaluate(main.sessionId, 'c.records().length > 0'));
  });
  await check('real IndexedDB quota failure preserves installed content', async () => {
    const { usage } = await send('Storage.getUsageAndQuota', { origin });
    await send('Storage.overrideQuotaForOrigin', { origin, quotaSize: usage + 10000 });
    try {
      await start(main.sessionId); await until(() => evaluate(main.sessionId, '!c.busy()'), 90000);
      const message = await evaluate(main.sessionId, 'c.message()');
      assert.doesNotMatch(message, /Content imported/);
      assert.match(message, /quota|storage|transaction/i);
      assert.equal(await evaluate(main.sessionId, 'c.revision().id'), secondId);
      return { message };
    } finally { await send('Storage.overrideQuotaForOrigin', { origin }); }
  });
  await check('mobile viewport smoke check (not a phone benchmark)', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, main.sessionId);
    await delay(500);
    const size = await evaluate(main.sessionId, `({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth})`);
    assert(size.scrollWidth <= size.viewport + 1, 'Horizontal page overflow'); return size;
  });
  await check('blocked database upgrade gives an actionable error and retries after unblock', async () => {
    const { browserContextId } = await send('Target.createBrowserContext');
    try {
      const isolated = await page(browserContextId);
      const result = await evaluate(isolated.sessionId, `await c.cache.savedSource('open');
        c.cache.connection.then(db => db.close());
        await new Promise((resolve,reject) => { const r = indexedDB.deleteDatabase('ally-content-v1'); r.onsuccess=resolve; r.onerror=reject; });
        globalThis.heldDb = await new Promise((resolve,reject) => { const r=indexedDB.open('ally-content-v1',2); r.onupgradeneeded=() => {
          const db=r.result; const records=db.createObjectStore('records',{keyPath:['revisionId','key']}); records.createIndex('revision','revisionId'); records.createIndex('category',['revisionId','kind']);
          db.createObjectStore('revisions',{keyPath:'id'}); db.createObjectStore('active',{keyPath:'key'}); db.createObjectStore('settings',{keyPath:'namespace'});
        }; r.onsuccess=()=>resolve(r.result); r.onerror=reject; });
        globalThis.h = await import(${JSON.stringify(helpers)}); globalThis.retryCache = new h.IndexedDbContentCache();
        let blocked; try { await retryCache.revisions('test'); } catch(e) { blocked=e.message; }
        heldDb.close(); await new Promise(resolve=>setTimeout(resolve,100));
        let retried; try { await retryCache.revisions('test'); retried=true; } catch { retried=false; }
        ({blocked,retried});`);
      assert.match(result.blocked, /Close other/); assert(result.retried); return result;
    } finally { await send('Target.disposeBrowserContext', { browserContextId }); }
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error.message); }
finally {
  await writeFile('docs/migration/browser-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.checks.filter(c => c.passed).length, failed: report.checks.filter(c => !c.passed).length, report: 'docs/migration/browser-acceptance-results.json' }));
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill(); server.close();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  pending.clear();
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-browser-')) {
    await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
}
