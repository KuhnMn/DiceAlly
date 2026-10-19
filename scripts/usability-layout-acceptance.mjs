// Run against ng serve on port 4201. Uses an isolated profile; requires no content download.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = process.env.ALLY_ORIGIN ?? 'http://127.0.0.1:4201';
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(temporaryRoot, 'ally-usability-layout-'));
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

await mkdir('tmp', {recursive:true});
const report = { phase: 'after', measurements: [], checks: [] };
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
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.navigate', { url: `${origin}/characters/new` }, session);
  await until(() => evaluate(session, `!!globalThis.ng && !!document.querySelector('app-root')`));
  // In-memory route harness only: no login, cloud requests, or persistence of fixtures.
  await evaluate(session, `globalThis.root=ng.getComponent(document.querySelector('app-root')); root.router.resetConfig(root.router.config.map(route=>({...route,canActivateChild:[],canDeactivate:[],children:route.children?.map(child=>({...child,canDeactivate:[]}))}))); root.router.navigateByUrl('/characters/new');`);
  await until(() => evaluate(session, `!!document.querySelector('app-local-editor')`));
  await evaluate(session, `globalThis.c=ng.getComponent(document.querySelector('app-local-editor'));
    c.character.name='Layout review'; c.character.description='A well-travelled wizard with a companion.';
    Object.assign(c.character,{level:5,maxHp:32,currentHp:24,abilityScores:{strength:10,dexterity:14,constitution:14,intelligence:18,wisdom:12,charisma:10},hitDice:[{dieType:'d6',total:5,used:1}],featureSources:[{name:'Wizard',useSpellbook:true,isSpellcastingSource:true,isGeneralFeatureSource:true,usesIntelligence:true}],spellSlots:{Wizard:[{level:1,total:4,used:1},{level:2,total:3,used:0},{level:3,total:2,used:0}]}});
    c.sheet.spells=[{name:'Arcane Spark',listType:'PREPARED',castingSourceName:'Wizard',editorId:'spell-1',entity:{name:'Arcane Spark',level:1,school:'V',time:[{number:1,unit:'reaction',condition:'when a creature within reach attacks an ally'}],range:{type:'point',distance:{type:'feet',amount:60}},components:{v:true,s:true,m:'a small shard of polished crystal'},duration:[{type:'instant'}],entries:['Synthetic spell reference.']}}];
    c.sheet.spells.push(...['KNOWN','SPELLBOOK'].map(listType=>({...structuredClone(c.sheet.spells[0]),editorId:'spell-'+listType,listType})));
    c.sheet.spells.push(...c.sheet.spells.map(spell=>({...structuredClone(spell),editorId:spell.editorId+'-long',name:'An extraordinarily long spell name repeated for narrow-screen truncation checks',source:'AReallyLongContentSourceWithoutSpaces',castingSourceName:'AnExtremelyLongCastingSourceWithoutSpaces'})));
    c.sheet.spells.filter(spell=>spell.name==='Arcane Spark').forEach(spell=>{spell.entity.meta={ritual:true};spell.entity.duration=[{type:'timed',duration:{amount:1,type:'minute'},concentration:true}];});
    c.sheet.features=[{name:'Arcane Recovery',featureSourceName:'Wizard',editorId:'feature-1',featureType:'CLASS_FEATURE',featureEntity:{name:'Arcane Recovery',level:1,className:'Wizard',classSource:'TEST',source:'TEST',entries:['Synthetic feature reference.']}}];
    c.sheet.features[0].source='TEST';c.sheet.features[0].notes=[{tag:'Reminders',notes:['Apply this manually at the table.'],isEditable:true},{tag:'Table notes',notes:['A second note group.'],isEditable:false}];
    c.sheet.features[0].uses=[1,2,3].map(number=>({tag:'Counter '+number,totalFreeUses:5,usedFreeUses:1,freeUsesRegainCondition:'LONG_REST'}));
    c.sheet.combatActions=[{editorId:'feature-action',name:'Arcane Recovery',actionType:'OTHER',damageOrHeal:'Synthetic reminder.',linkedResourceType:'CLASS_FEATURE',linkedResource:{editorId:'feature-1',name:'Arcane Recovery',source:'TEST'}}];
    c.sheet.species={name:'Elf',source:'TEST',entity:{name:'Elf',source:'TEST',entries:['Synthetic species reference.']},notes:[],uses:[]};
    c.sheet.inventory=[{name:'Staff',editorId:'item-1',isEquipped:true}];
    c.sheet.monsters=[{name:'Owl',editorId:'monster-1',hpEnabled:true,monsterMaxHP:4,monsterCurrentHP:4,entity:{name:'Owl',size:['T'],type:'beast',ac:[11],hp:{average:4},speed:{walk:5,fly:60}}}]; ng.applyChanges(c);`);
  // Source setup stays compact at narrow widths, with abilities on one row.
  await evaluate(session, `c.setPage(c.pages.indexOf('Feature Sources'));ng.applyChanges(c);`);
  for (const width of [320, 390, 1366]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, session);
    const sourceLayout = await evaluate(session, `(()=>{const card=document.querySelector('.source-editor');if(!card)throw new Error('Source card missing');card.scrollIntoView({block:'center'});const abilities=[...card.querySelectorAll('.source-ability')].map(item=>item.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth+1,rows:new Set(abilities.map(box=>Math.round(box.top))).size,abilityWidth:Math.min(...abilities.map(box=>box.width)),customOpen:card.querySelector('details').open}})()`);
    assert.equal(sourceLayout.overflow, false); assert.equal(sourceLayout.rows, 1);
    assert(sourceLayout.abilityWidth >= 30); assert.equal(sourceLayout.customOpen, false);
    const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile(`tmp/feature-sources-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  report.checks.push('Feature sources: six abilities on one row, custom fields collapsed, no overflow at 320/390/1366 px.');
  // Exercise all acquisition dialogs using in-memory results and stub only their
  // commit action. Native pointer events verify that stretched details controls
  // cover metadata/empty space without swallowing the separate Add/Select action.
  for (const width of [320, 390, 768, 1366]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, session);
    for (const [page, selector, kind, label] of [
      ['Spells', 'app-editor-spells', 'spell', 'spells'],
      ['Species & Features', 'app-editor-features', 'classFeature', 'features'],
      ['Species & Features', 'app-editor-species', 'species', 'species'],
      ['Items', 'app-editor-items', 'item', 'items'],
      ['Monsters', 'app-editor-monsters', 'monster', 'monsters'],
    ]) {
      await evaluate(session, `c.setPage(c.pages.indexOf(${JSON.stringify(page)}));ng.applyChanges(c);globalThis.owner=ng.getComponent(document.querySelector('${selector}'));void 0`);
      const management = await evaluate(session, `(()=>{const root=document.querySelector('${selector}'),rows=[...root.querySelectorAll('app-editor-entry-row')];return {heights:rows.map(row=>row.getBoundingClientRect().height),width:document.documentElement.scrollWidth}})()`);
      assert(management.heights.length > 0 && management.heights.every(height => height <= 60), label+' management rows '+JSON.stringify(management)); assert(management.width<=width+1);
      await evaluate(session, `globalThis.managedRoot=document.querySelector('${selector}');globalThis.managedBefore=JSON.stringify(c.sheet);void 0`);
      if (kind === 'spell') {
        await evaluate(session, `globalThis.membershipClicks=0;globalThis.originalMembership=owner.toggleMembership;owner.toggleMembership=()=>membershipClicks++;void 0`);
        const action = await evaluate(session, `(()=>{const row=[...managedRoot.querySelectorAll('app-editor-entry-row')].find(row=>row.textContent.includes('Wizard'));const button=row.querySelector('button[aria-label^="Unprepare "]');button.scrollIntoView({block:'center'});const box=button.getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
        await send('Input.dispatchMouseEvent', { type:'mousePressed',button:'left',clickCount:1,...action },session); await send('Input.dispatchMouseEvent', { type:'mouseReleased',button:'left',clickCount:1,...action },session); await delay(50);
        assert.equal(await evaluate(session,'membershipClicks'),1); assert.equal(await evaluate(session,'owner.expanded.size'),0);
        await evaluate(session,'owner.toggleMembership=originalMembership;void 0');
        await evaluate(session, `globalThis.managedControls=ng.getComponent(managedRoot.querySelector('app-list-controls'));managedControls.filtersOpen.set(true);ng.applyChanges(managedControls);void 0`);
        await evaluate(session, `const group=managedRoot.querySelector('[aria-label="Spell membership filters"]');for(const label of ['Prepared','Spellbook'])[...group.querySelectorAll('button')].find(button=>button.textContent.trim()===label).click();ng.applyChanges(owner);`);
        assert.equal(await evaluate(session,'owner.displayedMemberships.length'),2);
        assert.equal(await evaluate(session,'owner.selected.length'),2);
        assert.equal(await evaluate(session,`!!managedRoot.querySelector('app-spell-view-switcher,.spell-preparation-view')`),false);
        assert(await evaluate(session,'document.documentElement.scrollWidth<=innerWidth+1'),'Membership filter overflow');
        if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/managed-spells-filters-390.png',Buffer.from(shot.data,'base64'));}
        await evaluate(session, `managedRoot.querySelector('app-list-controls [aria-label="Clear filters and search"]').click();managedControls.filtersOpen.set(false);ng.applyChanges(owner);ng.applyChanges(managedControls);`);
        assert.equal(await evaluate(session,'owner.displayedMemberships.length'),0);
      }
      const detailPoint = await evaluate(session, `(()=>{const row=managedRoot.querySelector('app-editor-entry-row');row.scrollIntoView({block:'center'});const box=row.getBoundingClientRect();return {x:box.left+20,y:box.top+box.height-10}})()`);
      await send('Input.dispatchMouseEvent', { type:'mousePressed',button:'left',clickCount:1,...detailPoint },session); await send('Input.dispatchMouseEvent', { type:'mouseReleased',button:'left',clickCount:1,...detailPoint },session);
      await until(()=>evaluate(session,`!!managedRoot.querySelector('app-editor-entry-row button[aria-expanded="true"]')`));
      assert(await evaluate(session,'document.documentElement.scrollWidth<=innerWidth+1'),label+' expanded management overflow');
      assert(await evaluate(session,`[...managedRoot.querySelectorAll('.annotation-panel')].every(panel=>panel.hidden)`),'Annotation panels should start closed');
      for(const panel of ['uses','notes']) {
        await evaluate(session,`managedRoot.querySelector('app-entry-annotations-editor [aria-controls^="${panel}-panel-"]').click()`);await delay(35);
        assert(await evaluate(session,`(()=>{const tools=managedRoot.querySelector('app-entry-annotations-editor');return !tools.querySelector('[aria-label="${panel==='uses'?'Uses':'Notes'} editor"]').hidden&&tools.querySelector('[aria-label="${panel==='uses'?'Notes':'Uses'} editor"]').hidden})()`));
        assert(await evaluate(session,'document.documentElement.scrollWidth<=innerWidth+1'),label+' '+panel+' panel overflow');
        if(kind==='classFeature'&&(width===390||width===1366)){await evaluate(session,`managedRoot.querySelector('[aria-label="${panel==='uses'?'Uses':'Notes'} editor"]').scrollIntoView({block:'center'})`);const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile(`tmp/entry-${panel}-${width}.png`,Buffer.from(shot.data,'base64'));}
      }
      if(await evaluate(session,`!!managedRoot.querySelector('app-entry-annotations-editor app-description-dialog button')`)) {
        await evaluate(session,`managedRoot.querySelector('app-entry-annotations-editor app-description-dialog button').click()`);
        await until(()=>evaluate(session,`!!managedRoot.querySelector('app-description-dialog dialog[open]')`));
        assert(await evaluate(session,`getComputedStyle(managedRoot.querySelector('app-description-dialog dialog[open]')).whiteSpace==='normal'`));
        await evaluate(session,`managedRoot.querySelector('app-description-dialog [aria-label="Close details"]').click()`);await delay(35);
      }
      await evaluate(session,`(()=>{const combat=managedRoot.querySelector('app-combat-bookmark');(combat.querySelector('[aria-label^="Add another combat entry"]')||combat.querySelector('[aria-label$=" to Combat"]')).click()})()`);
      await until(()=>evaluate(session,`!!document.querySelector('app-combat-action-dialog app-catalog-dialog.compact')`));
      await delay(50);
      const combatMetric=await evaluate(session,`(()=>{const root=document.querySelector('app-combat-action-dialog'),dialog=root.querySelector('.catalog-window'),body=root.querySelector('.catalog-body');return {width:dialog.getBoundingClientRect().width,height:dialog.getBoundingClientRect().height,bodyWidth:body.clientWidth,bodyScrollWidth:body.scrollWidth,viewport:innerWidth}})()`);
      if(combatMetric.bodyScrollWidth>combatMetric.bodyWidth+1){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/entry-combat-overflow.png',Buffer.from(shot.data,'base64'));combatMetric.overflow=await evaluate(session,`(()=>{const body=document.querySelector('app-combat-action-dialog .catalog-body'),edge=body.getBoundingClientRect().right;return [...body.querySelectorAll('*')].filter(element=>element.getBoundingClientRect().right>edge+1).map(element=>({tag:element.tagName,class:element.className,width:element.getBoundingClientRect().width,minWidth:getComputedStyle(element).minWidth})).slice(0,12)})()`);}
      assert(combatMetric.width<=width-30&&combatMetric.height<900&&combatMetric.bodyScrollWidth<=combatMetric.bodyWidth+1,'Compact combat dialog overflow '+JSON.stringify(combatMetric));
      if(kind==='classFeature'&&(width===390||width===1366)){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile(`tmp/entry-combat-${width}.png`,Buffer.from(shot.data,'base64'));}
      await evaluate(session,`document.querySelector('app-combat-action-dialog [aria-label="Close catalog"]').click()`);await delay(35);
      await evaluate(session,`managedRoot.querySelector('app-editor-entry-row button[aria-expanded="true"]').click()`); await delay(30);
      assert.equal(await evaluate(session,'JSON.stringify(c.sheet)===managedBefore'),true,label+' viewing management mutated data');
      if(width===390||width===1366){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile(`tmp/managed-${label}-${width}.png`,Buffer.from(shot.data,'base64'));}
      await evaluate(session,`owner.catalogOpen=true;ng.applyChanges(owner);void 0`);
      await delay(100);
      await evaluate(session, `globalThis.e=ng.getComponent(document.querySelector('${kind === 'item' ? 'app-item-catalog' : selector}'));await e.refreshContent();void 0`);
      await delay(250);
      await evaluate(session, `globalThis.catalogRoot=document.querySelector('${selector} app-catalog-dialog')||document.querySelector('app-item-catalog app-catalog-dialog');
        globalThis.r={key:'catalog-layout-${kind}',kind:'${kind}',name:'A deliberately long catalog entry for checking narrow layouts',publication:'TEST',file:'synthetic.json',links:[],data:{name:'Synthetic entry',source:'TEST',level:1,school:'A',className:'Wizard',classSource:'TEST',entries:['Synthetic reference content.'],hp:{average:4},size:['T'],type:'beast',ac:[11],speed:{walk:30}}};
        (e.results||e.catalog.results).set([r]);(e.loading||e.catalog.loading).set(false);(e.message||e.catalog.message).set('');
        if(e.classNames)e.classNames.set(['Artificer','Bard','Cleric','Druid','Fighter','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
        if(e.catalogLevels?.set)e.catalogLevels.set([0,1,2,3,4,5,6,7,8,9]);
        if(e.catalogSchools)e.catalogSchools.set([{value:'A',label:'Abjuration'},{value:'C',label:'Conjuration'},{value:'D',label:'Divination'},{value:'E',label:'Enchantment'},{value:'V',label:'Evocation'},{value:'I',label:'Illusion'},{value:'N',label:'Necromancy'},{value:'T',label:'Transmutation'}]);
        if(e.catalogOptions)e.catalogOptions.set({classes:['Artificer','Bard','Cleric','Druid','Fighter','Ranger','Warlock','Wizard'],levels:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],categories:[]});
        globalThis.actionClicks=0;e.${kind === 'species' ? 'select' : 'add'}=()=>{actionClicks++};ng.applyChanges(e);void 0`);
      const metric = await evaluate(session, `(()=>{const row=catalogRoot.querySelector('app-catalog-result-row'),box=row.getBoundingClientRect();return {height:box.height,dialogWidth:catalogRoot.getBoundingClientRect().width,documentWidth:document.documentElement.scrollWidth,detailsText:row.querySelector('app-description-dialog button').textContent.trim(),sourceBeforeSearch:catalogRoot.querySelector('app-source-book-filter').compareDocumentPosition(catalogRoot.querySelector('app-list-controls'))&Node.DOCUMENT_POSITION_FOLLOWING}})()`);
      assert(metric.height <= 60, JSON.stringify(metric)); assert(metric.documentWidth <= width + 1, JSON.stringify(metric)); assert.equal(metric.detailsText, ''); assert(metric.sourceBeforeSearch);
      const point = await evaluate(session, `(()=>{const row=catalogRoot.querySelector('app-catalog-result-row');row.scrollIntoView({block:'center'});const box=row.getBoundingClientRect();return {x:box.left+20,y:box.top+box.height-10}})()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, session);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, session);
      await until(() => evaluate(session, `!!catalogRoot.querySelector('app-catalog-result-row dialog[open]')`));
      assert.equal(await evaluate(session, 'actionClicks'), 0);
      await evaluate(session, `catalogRoot.querySelector('app-catalog-result-row [aria-label="Close details"]').click()`); await delay(50);
      await evaluate(session, `catalogRoot.querySelector('app-catalog-result-row > div > button').click()`); await delay(50);
      assert.equal(await evaluate(session, 'actionClicks'), 1); assert.equal(await evaluate(session, `!!catalogRoot.querySelector('app-catalog-result-row dialog[open]')`), false);
      const filterButton = await evaluate(session, `!!catalogRoot.querySelector('app-list-controls button[aria-expanded]')`);
      if (filterButton) {
        await evaluate(session, `catalogRoot.querySelector('app-list-controls button[aria-expanded]').click()`); await delay(60);
        if (width < 640) {
          const rows = await evaluate(session, `Array.from(catalogRoot.querySelectorAll('app-list-controls [data-horizontal-row]')).map(row=>({wrap:getComputedStyle(row).flexWrap,width:row.clientWidth,scrollWidth:row.scrollWidth}))`);
          assert(rows.length > 0); assert(rows.every(row => row.wrap === 'nowrap'), JSON.stringify(rows));
        }
        assert(await evaluate(session, 'document.documentElement.scrollWidth <= innerWidth+1'));
        assert(await evaluate(session, `(()=>{const body=catalogRoot.querySelector('.catalog-body');return body.scrollWidth<=body.clientWidth+1})()`), label+' catalog body overflow at '+width);
      }
      if (width === 390 || width === 1366) { const shot = await send('Page.captureScreenshot', { format: 'png' }, session); await writeFile(`tmp/catalog-${label}-${width}.png`, Buffer.from(shot.data, 'base64')); }
      await evaluate(session, `owner.catalogOpen=false;ng.applyChanges(owner);void 0`);
    }
  }
  report.checks.push('All five management lists and catalogs: compact tagged rows, full-row details, independent membership/Add/Select actions, source scope first, and horizontally scrolling mobile filter groups.');
  const fixture = await evaluate(session, 'JSON.stringify(c.sheet)');
  for(const width of [320,390,768,1366]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false},session);
    await evaluate(session, 'c.setPage(0); ng.applyChanges(c); window.scrollTo(0,0)'); await delay(100);
    const metric=await evaluate(session, `(()=>{const form=document.querySelector('#basic-info');return {contentTop:Math.round(form.getBoundingClientRect().top+scrollY),width:innerWidth,documentWidth:document.documentElement.scrollWidth}})()`);
    assert(metric.documentWidth<=width+1,JSON.stringify(metric)); report.measurements.push({area:'creator',...metric});
    if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/usability-creator-mobile.png',Buffer.from(shot.data,'base64'));}
     {
      await evaluate(session, `const select=document.querySelector('select[aria-label="Character editor page"]'); if(select && getComputedStyle(select).display!=='none') {select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));} else c.setPage(1);ng.applyChanges(c);`);
      assert.equal(await evaluate(session,'c.page'),1); await evaluate(session,'c.setPage(0);ng.applyChanges(c)');
      await evaluate(session,'c.busy.set(true);c.setPage(1);ng.applyChanges(c)'); assert.equal(await evaluate(session,'c.page'),0); await evaluate(session,'c.busy.set(false);ng.applyChanges(c)');
    }
  }
  await evaluate(session, "root.characterStore.setCharacter(c.sheet);root.router.navigateByUrl('/sheet')"); await until(()=>evaluate(session,"!!document.querySelector('app-character-sheet')"));
  await evaluate(session,"globalThis.v=ng.getComponent(document.querySelector('app-character-sheet'));void 0");
  for(const width of [320,390,768,1366]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false},session); await delay(150);
    for(const [page,selector,card] of [[1,'app-character-info-page','header'],[3,'app-spells-page','.sheet-entry-list'],[2,'app-features-page','.sheet-entry-list'],[4,'app-equipment-page','.sheet-entry-list'],[5,'app-monsters-page','.sheet-entry-list']]) {
      if(width<640&&page===1)continue;
      await evaluate(session,`v.switchPage(${page},false);ng.applyChanges(v);window.scrollTo(0,0)`); await delay(100);
      const metric=await evaluate(session,`(()=>{const root=document.querySelector('${selector}');const list=root.querySelector('${card}');return {contentTop:Math.round(list.getBoundingClientRect().top+scrollY),height:Math.round(root.getBoundingClientRect().height),documentWidth:document.documentElement.scrollWidth,width:innerWidth}})()`);
      assert(metric.documentWidth<=width+1,JSON.stringify({selector,...metric}));report.measurements.push({area:selector,...metric});
      if(page!==1){
        await evaluate(session,`globalThis.p=ng.getComponent(document.querySelector('${selector}'));globalThis.controls=ng.getComponent(document.querySelector('${selector} app-list-controls'));controls.filtersOpen.set(true);ng.applyChanges(controls);`);
        assert.equal(await evaluate(session,`document.querySelector('${selector} app-list-controls button[aria-expanded]').getAttribute('aria-expanded')`),'true');
        const openTop=await evaluate(session,`Math.round(document.querySelector('${selector} ${card}').getBoundingClientRect().top+scrollY)`); report.measurements[report.measurements.length-1].collapsedFiltersSavePx=openTop-metric.contentTop;
        const openWidth=await evaluate(session,'document.documentElement.scrollWidth');assert(openWidth<=width+1,selector+' open overflow '+openWidth);
        await evaluate(session,`controls.filtersOpen.set(false);ng.applyChanges(controls)`);
      }
      if(page===3){
        await evaluate(session, `document.querySelector('app-spells-page [aria-label="Spelllist view"]').click(); ng.applyChanges(p);`);
        assert.equal(await evaluate(session,'p.spellView()'),'KNOWN');assert.equal(await evaluate(session,'p.activeFilterCount()'),0);
        const compact=await evaluate(session, `(()=>{const root=document.querySelector('app-spells-page');return {heights:[...root.querySelectorAll('.preparation-card')].map(card=>card.getBoundingClientRect().height),summaries:root.querySelectorAll('app-spell-summary').length,tinted:!!root.querySelector('.spell-preparation-view'),width:document.documentElement.scrollWidth}})()`);
        assert(compact.heights.length>0&&compact.heights.every(height=>height<=60),JSON.stringify(compact));assert.equal(compact.summaries,0);assert(compact.tinted);assert(compact.width<=width+1);
        if(width===390||width===1366){await evaluate(session,`window.scrollTo(0,document.querySelector('app-spells-page app-spell-view-switcher').getBoundingClientRect().top+scrollY-270)`);const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/spelllist-'+width+'.png',Buffer.from(shot.data,'base64'));}

        await evaluate(session, `p.spellCastingTimes.set(['reaction']);ng.applyChanges(p);document.querySelector('app-spells-page [aria-label="Clear filters and search"]').click();ng.applyChanges(p);`);
        assert.equal(await evaluate(session,'p.spellView()'),'KNOWN');assert.equal(await evaluate(session,'p.activeFilterCount()'),0);
        await evaluate(session, `document.querySelector('app-spells-page [aria-label="Spellbook view"]').click();ng.applyChanges(p)`);
        assert.equal(await evaluate(session,'p.spellView()'),'SPELLBOOK');
        assert.equal(await evaluate(session, `!!document.querySelector('app-spells-page #preparation-spell-slots')`),false);
        assert.equal(await evaluate(session, `!!document.querySelector('app-spells-page app-feature-source-picker app-source-stats')`),false);
        assert.equal(await evaluate(session, `!!document.querySelector('app-spells-page app-feature-source-picker [aria-label$="prepared spells"]')`),true);
        await evaluate(session, `document.querySelector('app-spells-page [aria-label="Only ritual spells"]').click();ng.applyChanges(p)`);
        assert.equal(await evaluate(session,'p.spellRitualFilter()'),'RITUAL');
        assert.equal(await evaluate(session,'p.spells().length'),1);
        assert.equal(await evaluate(session, 'p.spells().every(spell=>spell.entity?.meta?.ritual)'),true);
        const ritualWidth=await evaluate(session,'document.documentElement.scrollWidth');assert(ritualWidth<=width+1,'Ritual toolbar overflow');
        await evaluate(session, `document.querySelector('app-spells-page [aria-label="Only ritual spells"]').click();ng.applyChanges(p)`);
        if(width===390||width===1366){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/spellbook-'+width+'.png',Buffer.from(shot.data,'base64'));}
        await evaluate(session, `document.querySelector('app-spells-page [aria-label="View prepared spells"]').click();ng.applyChanges(p)`);
        assert.equal(await evaluate(session,'p.spellView()'),'PREPARED');
      }
      if(width===1366&&page===1){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/usability-sheet-desktop.png',Buffer.from(shot.data,'base64'));}
      if(width===390&&page===3) await evaluate(session,'window.scrollTo(0,650)');
      if(width===390&&page===3){const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/usability-spells-mobile.png',Buffer.from(shot.data,'base64'));}
    }
  }
  assert.equal(await evaluate(session, `!!document.querySelector('vite-error-overlay')`),false,'Development server error overlay');
  {
    await evaluate(session,'v.switchPage(3,false);ng.applyChanges(v);globalThis.p=ng.getComponent(document.querySelector("app-spells-page"));p.spellLevelFilters.set([9]);p.searchQuery.set("absent");ng.applyChanges(p)');
    await evaluate(session, `document.querySelector('app-spells-page app-list-controls button[aria-label="Clear filters and search"]').click()`);await delay(80);
    assert.equal(await evaluate(session,'p.spellsByLevel().length'),1);
    assert.equal(await evaluate(session,'p.searchQuery()'),'');
    report.checks.push('All four list disclosures open without overflow; clear restores results; creator selector shares page state and save guard.');
  }
  report.fixtureUnchanged=await evaluate(session,`JSON.stringify(v.characterData())===${JSON.stringify(fixture)}`);
  assert(report.fixtureUnchanged,'Viewing and filtering changed sheet data');
  const shot=await send('Page.captureScreenshot',{format:'png'},session);await writeFile('tmp/usability-layout-'+report.phase+'.png',Buffer.from(shot.data,'base64'));
  console.log(`PASS layout checks at 320, 390, 768, and 1366 px; report: tmp/usability-layout-after.json`);
} catch(error){report.error=error.message;process.exitCode=1;console.error(error);}
finally{
  await writeFile('tmp/usability-layout-'+report.phase+'.json',JSON.stringify(report,null,2));
  if(socket?.readyState===WebSocket.OPEN){await send('Browser.close').catch(()=>{});socket.close();}chrome.kill();
  for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(new Error('Browser closed'));}
  const absoluteProfile=await realpath(profile);
  if(absoluteProfile.startsWith(temporaryRoot+path.sep)&&path.basename(absoluteProfile).startsWith('ally-usability-layout-')) await rm(absoluteProfile,{recursive:true,force:true,maxRetries:10,retryDelay:250});
}
