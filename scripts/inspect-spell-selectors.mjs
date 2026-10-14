// Inspect selector metadata from the pinned source; do not save source data.
import { build } from 'esbuild';
const commit = '8c026b807fac21862a309379a0c3228a0683198b';
const root = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/data/`;
async function get(file) { const response = await fetch(root + file); if (!response.ok) throw new Error(`${file}: ${response.status}`); return response.json(); }
const queries = new Map(); const fields = new Set(); const levels = new Set();
function scan(value) {
  if (Array.isArray(value)) return value.forEach(scan);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['choose','all'].includes(key) && typeof child === 'string') queries.set(child, (queries.get(child) ?? 0) + 1);
    scan(child);
  }
}
const classIndex = await get('class/index.json');
for (const file of ['feats.json','races.json','optionalfeatures.json',...new Set(Object.values(classIndex).map(f => 'class/' + f))]) {
  const data = await get(file);
  for (const records of Object.values(data)) if (Array.isArray(records)) for (const record of records) {
    if (!Array.isArray(record.additionalSpells)) continue;
    for (const block of record.additionalSpells) {
      Object.keys(block).forEach(k => fields.add(k));
      for (const category of ['known','innate','prepared','expanded']) Object.keys(block[category] ?? {}).forEach(k => levels.add(k));
    }
    scan(record.additionalSpells);
  }
}
const bundle = await build({ entryPoints: ['src/app/rules/spell-filters.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { filterSpells } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const unsupported = [];
for (const query of queries.keys()) {
  try { filterSpells(query,new Map()); } catch(error) { unsupported.push({ query,error: error.message }); }
}
console.log(JSON.stringify({ commit, fields: [...fields], levels: [...levels], uniqueQueries: queries.size, unsupported, queries: [...queries].sort() }));
if (unsupported.length) process.exitCode = 1;
