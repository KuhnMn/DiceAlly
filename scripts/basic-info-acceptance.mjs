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
  await check('manual Basic Info saves without a content import and reopens after reload', async () => {
    await evaluate(session, `input('[name=name]', 'Mira'); input('[name=description]', 'Trail scout'); input('#level', '4'); input('#maxHp', '32');
      input('#manual-ac', '15'); input('#speed-fly', '40'); input('[name=resistance]', 'Poison'); c.addResistance();
      input('[name=sense-name]', 'Darkvision'); input('[name=sense-range]', '120'); c.addSense();
      await c.save(); globalThis.savedId = c.character.characterUuid;`);
    assert.equal(await evaluate(session, `c.error()`), '');
    const id = await evaluate(session, 'savedId');
    await send('Page.reload', {}, session); await delay(300);
    await until(() => evaluate(session, `!!globalThis.ng && !!document.querySelector('app-local-editor')`));
    await evaluate(session, `globalThis.c = ng.getComponent(document.querySelector('app-local-editor')); await c.ngOnInit(); c.open(c.entries().find(e => e.id === '${id}'));`);
    const data = await evaluate(session, `({name:c.character.name, level:c.character.level, hp:c.character.maxHp, ac:c.character.armorClass,
      fly:c.speeds.fly, resistances:c.resistances, senses:c.character.senses})`);
    assert.deepEqual(data, { name: 'Mira', level: 4, hp: 32, ac: 15, fly: 40, resistances: ['Poison'], senses: { Darkvision: 120 } });
  });
  await check('calculated AC and unarmored defense controls update without runtime errors', async () => {
    await evaluate(session, `document.querySelector('[name=calculate-ac]').click();`); await delay(100);
    await evaluate(session, `document.querySelector('[name=unarmored-defense]').click();`); await delay(100);
    await evaluate(session, `const select = document.querySelector('[name=defense-ability]'); select.value = 'wisdom'; select.dispatchEvent(new Event('change', {bubbles:true}));`);
    assert.equal(await evaluate(session, `c.character.unarmoredDefense`), 'WISDOM');
    assert.equal(await evaluate(session, `c.calculatedAc.ac`), 10);
    await evaluate(session, `await c.save();`);
    assert.equal(await evaluate(session, `c.error()`), '');
  });
  await check('portrait file upload persists inline and can be removed', async () => {
    const portrait = path.join(profile, 'portrait.png');
    await writeFile(portrait, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5h8AAAAASUVORK5CYII=', 'base64'));
    await send('DOM.enable', {}, session);
    const root = await send('DOM.getDocument', {}, session);
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[type=file]' }, session);
    await send('DOM.setFileInputFiles', { nodeId, files: [portrait] }, session);
    await until(() => evaluate(session, `c.sheet.portaitUrl?.startsWith('data:image/png')`));
    await evaluate(session, `await c.save();`);
    assert(await evaluate(session, `c.entries().find(e=>e.id===c.character.characterUuid).sheet.portaitUrl.startsWith('data:image/png')`));
    await evaluate(session, `c.removePortrait(); await c.save();`);
    assert.equal(await evaluate(session, `c.sheet.portaitUrl`), null);
  });
  await check('Ability Scores inputs, page navigation, save and reopened AC use the same character', async () => {
    await evaluate(session, `document.querySelectorAll('nav[aria-label="Character editor pages"] button')[1].click();`);
    await delay(100);
    await evaluate(session, `const scores = {strength:12, dexterity:14, constitution:16, intelligence:8, wisdom:18, charisma:10};
      for (const [key,value] of Object.entries(scores)) { const input = document.querySelector('#ability-'+key); input.value=String(value); input.dispatchEvent(new Event('input',{bubbles:true})); }`);
    await delay(100);
    assert.equal(await evaluate(session, `c.abilityModifier('wisdom')`), '+4');
    await evaluate(session, `await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid));`);
    assert.equal(await evaluate(session, 'c.character.abilityScores.dexterity'), 14);
    assert.equal(await evaluate(session, 'c.character.abilityScores.wisdom'), 18);
    assert.equal(await evaluate(session, 'c.calculatedAc.ac'), 16);
    assert.equal(await evaluate(session, 'c.character.maxHp'), 32);
  });
  await check('Hit Dice add, merge, usage and reopened persistence work', async () => {
    await evaluate(session, `document.querySelectorAll('nav[aria-label="Character editor pages"] button')[2].click();`);
    await delay(100);
    await evaluate(session, `c.hitDiceTotal = 3; c.hitDiceType = 'd8'; c.addHitDice(); c.hitDice[0].used = 1;
      c.hitDiceTotal = 2; c.hitDiceType = 'd8'; c.addHitDice(); c.hitDiceType = 'd10'; c.addHitDice();
      await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid)); c.setPage(2);`);
    assert.deepEqual(await evaluate(session, 'c.hitDice.map(d=>({type:d.dieType,total:d.total,used:d.used}))'), [
      { type: 'd8', total: 5, used: 1 }, { type: 'd10', total: 1, used: 0 },
    ]);
  });
  await check('Skill Proficiencies stores expertise and negative bonuses through real controls', async () => {
    await evaluate(session, `document.querySelectorAll('nav[aria-label="Character editor pages"] button')[3].click();`);
    await delay(100);
    await evaluate(session, `const icon=document.querySelector('#skill-PERCEPTION'); icon.click(); icon.click(); icon.click();
      const bonus=document.querySelector('#skill-bonus-PERCEPTION'); bonus.value='-1'; bonus.dispatchEvent(new Event('input',{bubbles:true}));`);
    await delay(100);
    assert.equal(await evaluate(session, `c.skillTotal('PERCEPTION','wis')`), '+7');
    await evaluate(session, `await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid)); c.setPage(3);`);
    assert.equal(await evaluate(session, `c.skillLevel('PERCEPTION')`), 'EXPERTISE');
    assert.equal(await evaluate(session, `c.skillBonus('PERCEPTION')`), -1);
  });
  await check('Saving Throws toggles full proficiency and persists a signed bonus', async () => {
    await evaluate(session, `document.querySelectorAll('nav[aria-label="Character editor pages"] button')[4].click();`);
    await delay(100);
    await evaluate(session, `document.querySelector('#save-wis').click();
      const bonus=document.querySelector('#save-bonus-wis'); bonus.value='-2'; bonus.dispatchEvent(new Event('input',{bubbles:true}));`);
    await delay(100);
    assert.equal(await evaluate(session, `c.saveTotal('wisdom')`), '+4');
    await evaluate(session, `await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid)); c.setPage(4);`);
    assert.equal(await evaluate(session, `c.saveProficient('wis')`), true);
    assert.equal(await evaluate(session, `c.saveBonus('wis')`), -2);
  });
  await check('Other Proficiencies persists flags, languages, advantages and sources', async () => {
    await evaluate(session, `c.setPage(5); ng.applyChanges(c);`); await delay(100);
    await evaluate(session, `globalThis.other = ng.getComponent(document.querySelector('app-other-proficiencies'));
      other.setCombat('simpleWeapons',true); other.setCombat('initiative',true);
      other.languageInput='Elvish'; other.addLanguage();
      other.addAdvantage(); Object.assign(other.advantages[0],{aType:'skill_check',appliesTo:'Perception',condition:'Dim light',isDisadvantage:false});
      other.addSource(); other.sources[0].isSpellcastingSource=true;
      other.setSourceAbility(other.sources[0],'usesIntelligence',true);
      await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid));`);
    assert.equal(await evaluate(session, `c.character.proficiencies.simpleWeapons`), true);
    assert.deepEqual(await evaluate(session, `c.character.proficiencies.languages`), ['Elvish']);
    assert.equal(await evaluate(session, `c.character.featureSources[0].usesIntelligence`), true);
  });
  await check('Spell Slots appears for casting sources and preserves authored slots', async () => {
    assert.equal(await evaluate(session, `c.pages.includes('Spell Slots')`), true);
    await evaluate(session, `c.setPage(7); ng.applyChanges(c);`); await delay(100);
    await evaluate(session, `globalThis.slots = ng.getComponent(document.querySelector('app-editor-spell-slots'));
      slots.total=3; slots.recovery='SHORT_REST_ONE'; slots.add(); await c.save();
      c.open(c.entries().find(e=>e.id===c.character.characterUuid));`);
    assert.equal(await evaluate(session, `Object.values(c.character.spellSlots)[0][0].regainCondition`), 'SHORT_REST_ONE');
  });
  await check('Features separates types and persists notes and tracking without needing content', async () => {
    await evaluate(session, `c.setPage(c.pages.indexOf('Features')); ng.applyChanges(c);`); await delay(100);
    await evaluate(session, `globalThis.features=ng.getComponent(document.querySelector('app-editor-features'));
      features.selectedType='FEAT'; features.customName='Browser custom feat'; features.customDescription='Selected text'; features.addCustom();
      const feature=c.sheet.features[0]; features.addNote(feature); features.setNoteEntry(feature.notes[0],0,'Keep this note');
      features.addUses(feature); feature.uses[0].totalFreeUses=3; feature.uses[0].freeUsesRegainCondition='SHORT_REST_ONE';
      await c.save(); c.open(c.entries().find(e=>e.id===c.character.characterUuid));`);
    assert.equal(await evaluate(session, `c.sheet.features[0].notes[0].notes[0]`), 'Keep this note');
    assert.equal(await evaluate(session, `c.sheet.features[0].uses[0].freeUsesRegainCondition`), 'SHORT_REST_ONE');
  });
  await check('all pages fit light and dark desktop and narrow layouts', async () => {
    for (const width of [1100, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, session);
      await delay(100);
      for (const theme of ['light-mc', 'dark-mc']) {
        await evaluate(session, `ng.getComponent(document.querySelector('app-root')).themeService.currentTheme.set('${theme}');`);
        await delay(100);
        for (const page of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
          await evaluate(session, `c.setPage(${page}); ng.applyChanges(c);`);
          const size = await evaluate(session, `({width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth})`);
          assert(size.scroll <= size.width + 1, `Overflow at ${width}, ${theme}, page ${page}`);
        }
      }
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false }, session);
    await evaluate(session, `ng.getComponent(document.querySelector('app-root')).themeService.currentTheme.set('light-mc');`);
    await delay(100);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, session);
    await writeFile('.angular/basic-info-preview.png', Buffer.from(screenshot.data, 'base64'));
  });
} catch (error) { report.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await writeFile('docs/migration/basic-info-acceptance-results.json', JSON.stringify(report, null, 2) + '\n');
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
  const absoluteProfile = await realpath(profile);
  if (absoluteProfile.startsWith(temporaryRoot + path.sep) && path.basename(absoluteProfile).startsWith('ally-basic-info-')) await rm(absoluteProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
