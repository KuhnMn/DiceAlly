// Developer-only parity check: execute pinned public upstream utilities in an isolated VM.
// No source corpus is saved, and no upstream code enters the browser bundle.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const commit = '8c026b807fac21862a309379a0c3228a0683198b';
const context = vm.createContext({ console, setTimeout, clearTimeout });
for (const file of ['parser.js', 'utils.js', 'render.js']) {
  const response = await fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/js/${file}`);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  vm.runInContext(await response.text(), context, { filename: file, timeout: 10000 });
}
const bundle = await build({ entryPoints: ['src/app/content/content-adapter.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { inheritCopy } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const cases = [
  { name: 'monster preservation', kind: 'monster', base: { page: 12, environment: ['forest'], legendaryGroup: { name: 'Group', source: 'TEST' }, hp: { average: 20 } } },
  { name: 'item preservation', kind: 'item', base: { tier: 'major', lootTables: ['A'], weight: 2 } },
  { name: 'explicit preservation and deletion', kind: 'monster', base: { environment: ['forest'], page: 12, hp: { average: 20 } }, child: { hp: null, _copy: { _preserve: { environment: true } } } },
  { name: 'default text selectors and tags', base: { action: [{ name: 'Old', entries: ['Old Old {@spell Old} {@b Old {@spell Old}}'], headerEntries: ['Old'], footerEntries: ['Old'], other: 'Old' }] }, mods: { action: { mode: 'replaceTxt', replace: 'old', flags: 'i', with: 'New' } } },
  { name: 'explicit text properties and tags', base: { action: [{ name: 'Old', entries: ['Old {@spell Old}'] }] }, mods: { action: { mode: 'replaceTxt', replace: 'Old', with: 'New', props: ['name'], tagInsensitive: true } } },
  { name: 'tag insensitive body', base: { action: ['Old {@spell Old}'] }, mods: { action: { mode: 'replaceTxt', replace: 'Old', with: 'New', tagInsensitive: true } } },
  { name: 'wildcard headers and field scope', base: { entries: ['Old'], variant: [{ entries: ['Old'] }], actionHeader: ['Old'], legendaryHeader: ['Old'] }, mods: { '*': { mode: 'replaceTxt', replace: 'Old', with: 'New' } } },
  { name: 'root before wildcard', base: { action: ['Old'] }, mods: { '*': { mode: 'replaceTxt', replace: 'Old', with: 'New' }, _: { mode: 'setProp', prop: 'action', value: ['Old Old'] } } },
  { name: 'template roots and ordered modifiers', base: { str: 10, action: ['Base'] }, child: { str: 12 }, mods: { action: { mode: 'appendArr', items: ['Child'] } }, templates: [{ name: 'Template', source: 'TEST', apply: { _root: { str: 18, dex: 16 }, _mod: { action: { mode: 'appendArr', items: ['Template'] } } } }] },
  { name: 'named array replacement', base: { action: [{ name: 'Old', entries: [] }] }, mods: { action: { mode: 'replaceArr', replace: { regex: '^old', flags: 'i' }, items: { name: 'New' } } } },
];
for (const test of cases) {
  const base = { name: 'Base', source: 'TEST', ...test.base };
  const child = { name: 'Child', source: 'TEST', ...test.child, _copy: { name: 'Base', source: 'TEST', ...test.child?._copy,
    ...(test.mods ? { _mod: test.mods } : {}), ...(test.templates ? { _templates: test.templates.map(({ name, source }) => ({ name, source })) } : {}) } };
  context.input = JSON.stringify({ base, child, templates: test.templates ?? [], kind: test.kind ?? 'feat' });
  const expected = JSON.parse(vm.runInContext(`(() => {
    const {base, child, templates, kind} = JSON.parse(input);
    DataUtil.generic.copyApplier.getCopy(DataUtil[kind], base, child, templates);
    delete child._isCopy;
    return JSON.stringify(child);
  })()`, context, { timeout: 10000 }));
  const actual = inheritCopy(base, child, test.templates ?? [], test.kind ?? 'feat');
  assert.deepEqual(actual, expected, test.name);
  console.log(`PASS ${test.name}`);
}
console.log(JSON.stringify({ commit, passed: cases.length }));
if (process.argv.includes('--full')) {
  async function load(entry) {
    const output = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  }
  const { discoverFiles, fetchContent, rawUrl } = await load('src/app/content/github-source.ts');
  const { mapContent } = await load('src/app/content/content-adapter.ts');
  const { entityKey } = await load('src/app/content/content.model.ts');
  const source = { owner: '5etools-mirror-3', repository: '5etools-src', branch: commit, directory: 'data' };
  const { files } = await discoverFiles(source, commit);
  const raw = new Map();
  for (const file of [...files, 'bestiary/template.json']) {
    const { value } = await fetchContent(rawUrl(source, commit, file));
    for (const record of mapContent(value, file).records) raw.set(record.key, record);
  }
  const memo = { upstream: new Map(), local: new Map() };
  function resolve(key, engine, ancestors = new Set()) {
    if (memo[engine].has(key)) return memo[engine].get(key);
    if (ancestors.has(key)) throw new Error('Copy cycle');
    const record = raw.get(key);
    if (!record) throw new Error(`Missing copy dependency ${key}`);
    ancestors = new Set(ancestors).add(key);
    let data = structuredClone(record.data);
    if (data._copy) {
      const baseKey = entityKey(record.kind, { ...data, ...data._copy });
      const base = resolve(baseKey, engine, ancestors);
      const templates = (data._copy._templates ?? []).map(ref => resolve(entityKey('monsterTemplate', ref), engine, ancestors));
      if (engine === 'local') data = inheritCopy(base, data, templates, record.kind);
      else {
        context.input = JSON.stringify({ base, child: data, templates, kind: record.kind });
        data = JSON.parse(vm.runInContext(`(() => {
          const {base, child, templates, kind} = JSON.parse(input);
          DataUtil.generic.copyApplier.getCopy(DataUtil[kind], base, child, templates);
          delete child._isCopy;
          return JSON.stringify(child);
        })()`, context, { timeout: 10000 }));
      }
    }
    memo[engine].set(key, data); return data;
  }
  let checked = 0; const differences = [];
  for (const record of raw.values()) {
    if (!record.data._copy) continue;
    checked++;
    try {
      const expected = resolve(record.key, 'upstream'); const actual = JSON.parse(JSON.stringify(resolve(record.key, 'local')));
      try { assert.deepEqual(actual, expected); }
      catch {
        const fields = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter(field => {
          try { assert.deepEqual(actual[field], expected[field]); return false; } catch { return true; }
        });
        differences.push({ key: record.key, fields });
      }
    } catch (error) { differences.push({ key: record.key, error: error.message }); }
  }
  console.log(JSON.stringify({ commit, checkedCopies: checked, differences }));
  if (differences.length) process.exitCode = 1;
  const { variantMatches, mergeSubrace, normalizeSpecies } = await load('src/app/content/content-materializer.ts');
  const bases = [...raw.values()].filter(r => r.kind === 'baseitem');
  const variants = [...raw.values()].filter(r => r.kind === 'magicvariant');
  let checkedVariantPairs = 0; const mappingDifferences = [];
  for (const base of bases) for (const variant of variants) {
    const baseData = resolve(base.key, 'local'); const variantData = resolve(variant.key, 'local');
    context.input = JSON.stringify({ base: baseData, variant: variantData });
    const expected = vm.runInContext(`(() => { const {base, variant} = JSON.parse(input);
      return Renderer.item._createSpecificVariants_hasRequiredProperty(base, variant)
        && !Renderer.item._createSpecificVariants_hasExcludedProperty(base, variant);
    })()`, context, { timeout: 10000 });
    checkedVariantPairs++;
    if (variantMatches(baseData, variantData) !== expected) mappingDifferences.push({ base: base.key, variant: variant.key });
  }
  let checkedSubraces = 0; const intentionalDifferences = [];
  for (const sub of raw.values()) {
    if (sub.kind !== 'subrace') continue;
    const subData = resolve(sub.key, 'local');
    const parentKey = entityKey('race', { name: subData.raceName, source: subData.raceSource });
    const base = resolve(parentKey, 'local');
    context.input = JSON.stringify({ base, sub: subData });
    const expected = normalizeSpecies(JSON.parse(vm.runInContext(`(() => { const {base, sub} = JSON.parse(input);
      return JSON.stringify(Renderer.race._getMergedSubrace(base, sub));
    })()`, context, { timeout: 10000 })));
    const actual = mergeSubrace(base, subData);
    for (const field of ['languageProficiencies', 'traitTags']) {
      if (!Array.isArray(expected[field])) continue;
      const deduplicated = [...new Map(expected[field].map(value => [JSON.stringify(value), value])).values()];
      if (deduplicated.length !== expected[field].length) {
        intentionalDifferences.push({ subrace: sub.key, field, policy: 'deduplicated identical options' });
        expected[field] = deduplicated;
      }
    }
    const fields = ['ability', 'entries', 'speed', 'size', 'darkvision', 'resist', 'skillProficiencies', 'languageProficiencies', 'traitTags'];
    const changed = fields.filter(field => {
      try { assert.deepEqual(actual[field], expected[field]); return false; } catch { return true; }
    });
    checkedSubraces++;
    if (changed.length) mappingDifferences.push({ subrace: sub.key, fields: changed });
  }
  console.log(JSON.stringify({ commit, checkedVariantPairs, checkedSubraces, mappingDifferences, intentionalDifferences }));
  if (mappingDifferences.length) process.exitCode = 1;
}
