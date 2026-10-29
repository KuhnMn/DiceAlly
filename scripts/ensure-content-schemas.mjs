import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filesUnder } from './test-catalog.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function generatedSchemasCurrent(root, inputs, outputs, stamp) {
  const fingerprint = hash(inputs.map(file => `${file}:${hash(readFileSync(path.join(root, file)))}`).join('\n'));
  try {
    const saved = JSON.parse(readFileSync(path.join(root, stamp), 'utf8'));
    if (saved.fingerprint !== fingerprint) return { current: false, fingerprint };
    if (outputs.every(file => saved.outputs[file] === hash(readFileSync(path.join(root, file))))) return { current: true, fingerprint };
  } catch { /* Missing or edited artifacts require generation. */ }
  return { current: false, fingerprint };
}
export function ensureContentSchemas(root = process.cwd()) {
  const directory = 'src/app/content/generated';
  const stamp = '.angular/cache/content-schema-generation.json';
  const inputs = [...filesUnder(root, 'schemas'), ...filesUnder(root, 'scripts').filter(file => !file.endsWith('.test.mjs') && /(?:content-schema|generate-content-schema)/.test(file)), 'package-lock.json'];
  const hashes = path.join(root, directory, 'artifact-hashes.json');
  let names = [];
  try { if (existsSync(hashes)) names = Object.keys(JSON.parse(readFileSync(hashes, 'utf8'))); } catch { /* Rebuild a corrupt manifest too. */ }
  const outputs = [...names.map(name => `${directory}/${name}`), `${directory}/artifact-hashes.json`];
  const state = generatedSchemasCurrent(root, inputs, outputs, stamp);
  if (state.current && names.length) { console.log('Schema artifacts unchanged; generation skipped.'); return; }
  const result = spawnSync(process.execPath, ['scripts/generate-content-schemas.mjs'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Schema generation failed.');
  const generated = Object.keys(JSON.parse(readFileSync(hashes, 'utf8'))).map(name => `${directory}/${name}`);
  generated.push(`${directory}/artifact-hashes.json`);
  mkdirSync(path.dirname(path.join(root, stamp)), { recursive: true });
  writeFileSync(path.join(root, stamp), JSON.stringify({ fingerprint: state.fingerprint,
    outputs: Object.fromEntries(generated.map(file => [file, hash(readFileSync(path.join(root, file)))])) }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ensureContentSchemas();
