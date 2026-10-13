// Read-only upstream probe. No downloaded content is written to disk.
// This measures the adapter in Node, not browser IndexedDB or mobile performance.
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/app/content/content-importer.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { importContent } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
if (process.argv.includes('--inspect-mapping')) {
  const revision = '8c026b807fac21862a309379a0c3228a0683198b';
  for (const file of ['races.json', 'items-base.json', 'magicvariants.json']) {
    const data = await (await fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${revision}/data/${file}`)).json();
    if (file === 'magicvariants.json') console.log(JSON.stringify({ file, fields: [...new Set(data.magicvariant.flatMap(r => Object.keys(r)))], inheritedFields: [...new Set(data.magicvariant.flatMap(r => Object.keys(r.inherits ?? {})))], requirementFields: [...new Set(data.magicvariant.flatMap(r => (r.requires ?? []).flatMap(Object.keys)))], variants: data.magicvariant.slice(0, 2).map(r => ({ name: r.name, requires: r.requires, excludes: r.excludes, inherits: Object.fromEntries(Object.entries(r.inherits ?? {}).filter(([k]) => k !== 'entries')) })) }));
    else if (file === 'races.json') console.log(JSON.stringify({ file, subraceCount: data.subrace.length, fields: [...new Set(data.subrace.flatMap(Object.keys))], samples: data.subrace.slice(0, 3).map(r => ({ name: r.name, source: r.source, raceName: r.raceName, raceSource: r.raceSource, ability: r.ability })) }));
    else console.log(JSON.stringify({ file, baseCount: data.baseitem.length, categories: Object.keys(data), sample: data.baseitem.slice(0, 2).map(r => ({ name: r.name, source: r.source, type: r.type, property: r.property, mastery: r.mastery })), typeSamples: data.itemType.map(r => ({ name: r.name, source: r.source, abbreviation: r.abbreviation })), propertySamples: data.itemProperty.slice(0, 6).map(r => ({ name: r.name, source: r.source, abbreviation: r.abbreviation })) }));
  }
} else if (process.argv.includes('--inspect')) {
  const revision = '8c026b807fac21862a309379a0c3228a0683198b';
  for (const file of ['bestiary/bestiary-jttrc.json', 'bestiary/template.json']) {
    const response = await fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${revision}/data/${file}`);
    if (!response.ok) throw new Error(`${file}: ${response.status}`);
    const data = await response.json();
    if (data.monster) console.log(JSON.stringify({ file, records: data.monster.filter(r => r._copy?._templates || r._copy?._trait).map(r => ({ name: r.name, source: r.source, base: { name: r._copy.name, source: r._copy.source }, templates: r._copy._templates, trait: r._copy._trait })) }));
    else console.log(JSON.stringify({ file, keys: Object.keys(data), templates: (data.monsterTemplate ?? []).map(t => ({ name: t.name, source: t.source, root: t.apply?._root,
      mods: Object.fromEntries(Object.entries(t.apply?._mod ?? {}).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map(m => ({ mode: m.mode, prop: m.prop, scalar: m.scalar, expression: m.formula, variableTokens: JSON.stringify(m).match(/<\$[^>]+\$>/g) }))])) })) }));
  }
} else {
const records = new Map();
let maxHeap = 0;
const cache = {
  async stage() {},
  async put(id, rows) { for (const row of rows) records.set(row.key, row); },
  async get(id, key) { return records.get(key); },
  async visit(id, visitor) { for (const row of records.values()) await visitor(row); },
  async activate() {},
  async discard() {},
};
let lastProgress;
try {
  const revision = await importContent(cache, {
    namespace: 'probe', source: { owner: '5etools-mirror-3', repository: '5etools-src', branch: 'main', directory: 'data' },
    progress(p) {
      lastProgress = p; maxHeap = Math.max(maxHeap, process.memoryUsage().heapUsed);
      if (['resolve', 'discover', 'complete'].includes(p.phase) || (p.phase === 'download' && p.completed % 20 === 0) || (['link', 'materialize'].includes(p.phase) && p.completed === 0)) console.log(JSON.stringify(p));
    },
  });
  const mappingCounts = {};
  for (const row of records.values()) if (row.derivation) mappingCounts[row.derivation.operation] = (mappingCounts[row.derivation.operation] ?? 0) + 1;
  console.log(JSON.stringify({ status: 'passed', commit: revision.commit, metrics: revision.metrics, mappingCounts,
    warningCount: revision.diagnostics.filter(d => d.severity === 'warning').length, nodePeakSampledHeapBytes: maxHeap }));
} catch (error) {
  const modes = {};
  for (const record of records.values()) {
    const copy = record.data._copy;
    if (!copy) continue;
    for (const [field, raw] of Object.entries(copy._mod ?? copy.mod ?? {})) {
      for (const modifier of Array.isArray(raw) ? raw : [raw]) {
        const key = `${field}:${modifier.mode ?? typeof modifier}`;
        modes[key] = (modes[key] ?? 0) + 1;
      }
    }
  }
  console.log(JSON.stringify({ status: 'blocked', message: error.message, commit: error.revision?.commit, metrics: error.revision?.metrics, lastProgress,
    diagnosticCount: error.diagnostics?.length ?? 0,
    groups: Object.values((error.diagnostics ?? []).reduce((groups, d) => {
      const key = d.message.startsWith('Unresolved') ? d.message.split(':')[0] : d.message.startsWith('Error: Copy base') ? 'Copy base missing' : d.message;
      groups[key] ??= { message: key, count: 0, sample: d }; groups[key].count++; return groups;
    }, {})), copyModes: modes,
    namelessParent: [...records.values()].filter(r => r.kind === 'subrace' && !r.data.raceName).map(r => ({ name: r.name, fields: Object.keys(r.data), parent: r.data._copy ? { raceName: r.data._copy.raceName, raceSource: r.data._copy.raceSource } : null })),
    nodePeakSampledHeapBytes: maxHeap }));
  process.exitCode = 1;
}
}
