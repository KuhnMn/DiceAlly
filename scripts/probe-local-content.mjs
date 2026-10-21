import { referenceSchemas } from './content-schema-config.mjs';
// Reproducible Node probe against a read-only local corpus; never copies source data.
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dataDirectory = process.argv[2];
if (!dataDirectory) throw new Error('Usage: node scripts/probe-local-content.mjs <5etools-src/data> [--baseline]');
const baseline = process.argv.includes('--baseline');
const repository = path.dirname(path.resolve(dataDirectory));
const git = (cwd, ...args) => execFileSync('git', ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, '-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = git(repository, 'rev-parse', 'HEAD');
git(repository, 'diff', '--exit-code', 'HEAD', '--', 'data');
const applicationCommit = git(process.cwd(), 'rev-parse', 'HEAD');
const output = path.resolve('.angular/cache', `content-probe-${baseline ? 'baseline' : 'current'}.mjs`);
await mkdir(path.dirname(output), { recursive: true });
await build({ stdin: { contents: "export { importContent } from './src/app/content/content-importer';", resolveDir: process.cwd() },
  outfile: output, bundle: true, format: 'esm', platform: 'node',
  plugins: baseline ? [{ name: 'read-head-content', setup(builder) {
    builder.onLoad({ filter: /src[\\/]app[\\/]content[\\/].*\.ts$/ }, args => {
      const relative = path.relative(process.cwd(), args.path).replaceAll('\\', '/');
      try { return { contents: git(process.cwd(), 'show', `HEAD:${relative}`), loader: 'ts' }; }
      catch { return undefined; }
    });
  } }] : [],
});
const { importContent } = await import(pathToFileURL(output).href);
const records = new Map();
const cache = {
  async stage() {}, async put(_id, batch) { for (const row of batch) records.set(row.key, row); },
  async get(_id, key) { return records.get(key); },
  async visit(_id, visitor) { for (const row of records.values()) await visitor(row); },
  async activate() {}, async discard() {},
};
let sampledHeapBytes = 0;
const started = performance.now();
let result;
try {
  const revision = await importContent(cache, {
    namespace: 'local-probe', source: { owner: 'local', repository: 'local', branch: 'main', directory: 'data' },
    progress() { sampledHeapBytes = Math.max(sampledHeapBytes, process.memoryUsage().heapUsed); },
  }, async url => {
    if (url.startsWith('https://api.github.com/')) return { value: { sha: commit }, bytes: 0 };
    const file = decodeURIComponent(new URL(url).pathname.split(`/${commit}/data/`)[1]);
    const absolute = path.resolve(dataDirectory, file);
    if (!absolute.startsWith(path.resolve(dataDirectory) + path.sep)) throw new Error(`Escaping corpus path: ${file}`);
    const text = await readFile(absolute, 'utf8');
    return { value: JSON.parse(text), bytes: Buffer.byteLength(text) };
  });
  const referenceDefinitionCounts = {};
  for (const row of records.values()) {
    if (!Object.hasOwn(referenceSchemas, row.kind)) continue;
    if (row.referenceDefinition) {
      referenceDefinitionCounts[row.kind] = (referenceDefinitionCounts[row.kind] ?? 0) + 1;
    } else if (!baseline) throw new Error(`Missing stored reference definition: ${row.key}`);
  }
  result = { status: 'passed', mode: baseline ? 'baseline' : 'current', applicationCommit, contentCommit: commit,
    adapterVersion: revision.adapterVersion, schemaSnapshot: revision.schemaSnapshot,
    referenceDefinitionCounts, files: revision.files.length, metrics: revision.metrics,
    counts: Object.fromEntries([...new Set([...records.values()].map(row => row.kind))].sort().map(kind => [kind, [...records.values()].filter(row => row.kind === kind).length])),
    diagnosticCount: revision.diagnostics.length, diagnostics: revision.diagnostics,
    nodeSampledHeapBytes: sampledHeapBytes };
} catch (error) {
  result = { status: 'failed', mode: baseline ? 'baseline' : 'current', applicationCommit, contentCommit: commit,
    message: error.message, diagnostics: error.diagnostics, elapsedMs: Math.round(performance.now() - started) };
  process.exitCode = 1;
}
const report = `docs/migration/schema-adapter-${baseline ? 'baseline' : 'current'}-results.json`;
await writeFile(report, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, diagnostics: undefined, report }));
