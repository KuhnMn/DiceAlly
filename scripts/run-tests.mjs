import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ensureContentSchemas } from './ensure-content-schemas.mjs';
import { testCatalog, quickTests } from './test-catalog.mjs';

const started = performance.now();
const root = process.cwd();
const args = process.argv.slice(2);
const mode = args.shift() ?? 'quick';
const listOnly = args.includes('--list');
const watch = args.includes('--watch');
const baseOption = args.findIndex(arg => arg === '--base' || arg.startsWith('--base='));
let base;
if (baseOption >= 0) {
  const option = args.splice(baseOption, 1)[0];
  base = option.includes('=') ? option.slice(7) : args.splice(baseOption, 1)[0];
  if (!base || base.startsWith('-')) throw new Error('--base needs a Git revision.');
}
const paths = args.filter(arg => !['--list', '--watch', '--watch=false'].includes(arg));
if (paths.some(arg => arg.startsWith('-'))) throw new Error('Supported options: --list, --watch, --base <revision>.');
const catalog = testCatalog(root);
let selection;
if (paths.length || mode === 'changed') {
  const git = argv => execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const changed = paths.length ? paths.map(file => path.relative(root, path.resolve(root, file)).split(path.sep).join('/')) : [...new Set([...git(['diff', '--name-only', '-z', base ?? 'HEAD', '--']), ...git(['ls-files', '--others', '--exclude-standard', '-z'])])];
  const { affectedTests } = await import('./test-impact.mjs');
  const impact = affectedTests(root, changed);
  selection = impact.tests;
  console.log(impact.reason);
  if (impact.uncovered.length) console.warn('No test dependency found for:', impact.uncovered.join(', '));
  if (!changed.length) { console.log('No uncommitted changes; running the quick safety checks.'); selection = catalog.filter(test => quickTests.includes(test.file)); }
} else if (mode === 'quick') selection = catalog.filter(test => quickTests.includes(test.file));
else if (['unit', 'ui', 'all'].includes(mode)) selection = catalog.filter(test => mode === 'all' || test.runner === mode);
else throw new Error('Unknown test group. Use quick, changed, unit, ui or all.');

if (mode === 'unit' || mode === 'ui') selection = selection.filter(test => test.runner === mode);
const unit = selection.filter(test => test.runner === 'unit').map(test => test.file);
const ui = selection.filter(test => test.runner === 'ui').map(test => test.file);
console.log(`Selected ${selection.length}/${catalog.length} files: ${unit.length} Node, ${ui.length} Angular.`);
if (listOnly) { selection.forEach(test => console.log(`${test.runner}: ${test.file}`)); process.exit(0); }
if (!selection.length) { console.log('No affected product tests. Run test:tools for test tooling, or test:all for a complete check.'); process.exit(0); }
if (watch && unit.length && ui.length) throw new Error('Watch one runner at a time: use test:unit or test:ui.');
ensureContentSchemas(root);
function run(argv, extraEnv = {}) {
  const result = spawnSync(process.execPath, argv, { cwd: root, stdio: 'inherit', env: { ...process.env, NG_BUILD_MAX_WORKERS: process.env.NG_BUILD_MAX_WORKERS ?? '4', ...extraEnv } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (unit.length) run(['node_modules/vitest/vitest.mjs', ...(watch ? [] : ['run']), '--config', 'vitest.node.config.mjs'], { DICEALLY_TEST_FILES: JSON.stringify(unit) });
if (ui.length) run(['node_modules/@angular/cli/bin/ng.js', 'test', `--watch=${watch}`, ...ui.map(file => `--include=${file}`)]);

if (mode === 'all') {
  run(['scripts/test-workflow.test.mjs']);
  run(['scripts/retain-release-assets.test.mjs']);
}
console.log(`Checks finished in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
