// Isolated headless browser acceptance with real, pinned class/species content.
// No downloaded corpus or character payload is written to disk.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const origin = process.env.ALLY_ORIGIN ?? 'http://127.0.0.1:4201';
const commit = '8c026b807fac21862a309379a0c3228a0683198b';
const bundle = await build({ stdin: { contents: `
  export { IndexedDbContentCache } from './src/app/content/content-cache';
  export { mapContent } from './src/app/content/content-adapter';
  export { normalizeSpecies } from './src/app/content/content-materializer';
  export { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, sourceIdentity, entityKey } from './src/app/content/content.model';
`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const raw = {};
for (const file of ['class/class-fighter.json', 'class/class-wizard.json', 'races.json', 'optionalfeatures.json']) {
  const response = await fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/data/${file}`);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  raw[file] = await response.json();
}
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': req.url === '/data' ? 'application/json' : 'text/javascript' });
  res.end(req.url === '/data' ? JSON.stringify(raw) : bundle.outputFiles[0].text);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const helpers = `http://127.0.0.1:${server.address().port}`;
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(temporaryRoot, 'ally-creator-'));
const chrome = spawn(process.env.ALLY_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let launchError; chrome.on('error', e => launchError = e); chrome.stderr.on('data', () => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(work) {
  const start = Date.now();
  while (Date.now() - start < 30000) { const result = await work(); if (result) return result; await delay(100); }
  throw new Error('Timed out waiting for browser readiness.');
}
let socket; let nextId = 0; const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(session, expression) {
  if (expression.startsWith('(async')) expression = `await ${expression}`;
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
const report = { commit, checks: [], limitations: ['Headless desktop Chrome; physical phone and interactive visual acceptance remain deferred.'] };
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
    clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
  });
  const { targetId } = await send('Target.createTarget', { url: `${origin}/characters/new` });
  const { sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true });
  await until(() => evaluate(session, `!!document.querySelector('app-local-editor') && !!globalThis.ng && !ng.getComponent(document.querySelector('app-local-editor')).busy()`));
  await evaluate(session, `globalThis.c = ng.getComponent(document.querySelector('app-local-editor')); globalThis.h = await import('${helpers}/helpers');`);
  await check('seed real pinned fighter/wizard and materialized dwarf content', async () => {
    const result = await evaluate(session, `(async () => {
      const raw = await (await fetch('${helpers}/data')).json();
      const records = Object.entries(raw).flatMap(([file, data]) => h.mapContent(data, file).records).filter(r => r.kind !== 'race' && r.kind !== 'subrace');
      const dwarf = raw['races.json'].race.find(r => r.name === 'Dwarf' && r.source === 'XPHB');
      if (!dwarf) throw new Error('Pinned Dwarf not found');
      const data = h.normalizeSpecies(dwarf); records.push({ key: h.entityKey('species', data), kind: 'species', name: data.name, publication: data.source, file: 'races.json', data, links: [] });
      globalThis.revision = { id: crypto.randomUUID(), namespace: 'development-local', source: h.DEFAULT_CONTENT_SOURCE,
        sourceIdentity: h.sourceIdentity(h.DEFAULT_CONTENT_SOURCE), commit: '${commit}', adapterVersion: h.ADAPTER_VERSION,
        status: 'staging', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: records.length, elapsedMs: 0, mappedBytes: 0 } };
      const cache = new h.IndexedDbContentCache(); await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision);
      await c.ngOnInit(); await c.create(); return !!c.document;
    })()`);
    assert(result);
  });
  await check('real Fighter and Dwarf creation resolves choice controls and saves', async () => {
    const result = await evaluate(session, `(async () => {
      c.document.identity.name = 'Browser acceptance'; c.addClass();
      c.document.creation.classes.selections[0].classKey = c.records('class').find(r => r.name === 'Fighter' && r.publication === 'PHB').key;
      c.speciesKey = c.records('species')[0].key; c.selectSpecies();
      c.document.creation.abilities.con = 14; c.document.creation.abilities.dex = 14;
      const choices = c.choices;
      c.document.creation.proficiencyAnswers = Object.fromEntries(choices.proficiencies.choices.map(choice => [choice.id, choice.candidates.slice(0, choice.count)]));
      c.document.creation.classes.optionalAnswers = Object.fromEntries(c.optionalSlots.map(slot => [slot.id,
        c.optionalCandidates(slot.featureTypes).filter(r => r.name === 'Defense' && r.publication === 'PHB').slice(0, slot.count).map(r => r.key)]));
      c.review(); const diagnostics = c.preview.diagnostics;
      if (!c.preview.proposed) return { diagnostics };
      await c.applyAndSave(); return { diagnostics, hp: c.document.derived.maxHp, features: c.document.instances.features.length, message: c.message() };
    })()`);
    console.log(JSON.stringify(result));
    assert.deepEqual(result.diagnostics, []); assert.equal(result.hp, 12); assert(result.features > 0); assert.match(result.message, /saved/);
  });
  await check('sheet session edits save into native document and reopen', async () => {
    await evaluate(session, `c.notes = 'Keep'; c.review(); await c.applyAndSave(); await c.open(c.entries()[0]); await c.showSheet();`);
    await until(() => evaluate(session, `!!document.querySelector('app-character-sheet')`));
    const result = await evaluate(session, `(async () => {
      const sheet = ng.getComponent(document.querySelector('app-character-sheet'));
      sheet.characterData().character.currentHp = 5; await sheet.quickSave();
      return sheet.saveStatus();
    })()`); assert(result);
    await send('Page.navigate', { url: `${origin}/characters/new` }, session);
    await delay(250);
    await until(() => evaluate(session, `!!globalThis.ng && !!document.querySelector('app-local-editor') && !ng.getComponent(document.querySelector('app-local-editor')).busy()`));
    const hp = await evaluate(session, `globalThis.c = ng.getComponent(document.querySelector('app-local-editor')); await c.open(c.entries()[0]); c.document.session.currentHp;`);
    assert.equal(hp, 5);
  });
  await check('multiclass level preview and draft survive browser reload', async () => {
    const result = await evaluate(session, `(async () => {
      c.document.creation.classes.selections[0].level = 3;
      c.addClass(); c.document.creation.classes.selections[1].classKey = c.records('class').find(r => r.name === 'Wizard' && r.publication === 'PHB').key;
      c.document.overrides.armorClass = 18; c.review();
      if (!c.preview.proposed) return { diagnostics: c.preview.diagnostics };
      await c.applyAndSave(); c.document.identity.description = 'Recovered draft'; await c.saveDraft();
      return { diagnostics: [], ac: c.document.derived.stats.ac, classes: c.document.creation.classes.selections.length };
    })()`);
    assert.deepEqual(result.diagnostics, []); assert.equal(result.ac, 18); assert.equal(result.classes, 2);
    await send('Page.reload', {}, session);
    await delay(250);
    await until(() => evaluate(session, `!!globalThis.ng && !!document.querySelector('app-local-editor') && !ng.getComponent(document.querySelector('app-local-editor')).busy()`));
    assert.equal(await evaluate(session, `globalThis.c = ng.getComponent(document.querySelector('app-local-editor')); await c.open(c.entries()[0]); c.document.identity.description;`), 'Recovered draft');
  });
  await check('all editor steps render without horizontal overflow', async () => {
    for (let step = 0; step < 5; step++) {
      await evaluate(session, `c.step = ${step}; ng.applyChanges(c);`);
      const size = await evaluate(session, `({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })`);
      assert(size.scroll <= size.width + 1);
    }
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/creator-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill(); server.close();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-creator-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
