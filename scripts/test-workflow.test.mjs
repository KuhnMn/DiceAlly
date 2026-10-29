import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { affectedTests } from './test-impact.mjs';
import { generatedSchemasCurrent } from './ensure-content-schemas.mjs';
import { quickTests, testCatalog } from './test-catalog.mjs';

function fixture(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'diceally-test-plan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), text); };
  for (const [file, text] of Object.entries(files)) write(file, text);
  return { root, write };
}
const names = result => result.tests.map(test => test.file);

test('selects indirect consumers, dynamic imports and workers without unrelated tests', t => {
  const { root } = fixture(t, {
    'src/helper.ts': 'export const n = 1;',
    'src/service.ts': "export {n} from './helper';",
    'src/page.ts': "const worker = new URL('./service', import.meta.url); const load = () => import('./service');",
    'src/page.spec.ts': "import './page';",
    'src/other.spec.ts': 'const other = 1;',
  });
  assert.deepEqual(names(affectedTests(root, ['src/helper.ts'])), ['src/page.spec.ts']);
});
test('follows templates and component styles, including deleted imports', t => {
  const { root } = fixture(t, {
    'src/page.ts': "import './deleted'; const metadata = {templateUrl: './page.html', styleUrl: './page.css'};",
    'src/page.html': '<button>Test</button>', 'src/page.css': 'button {}',
    'src/page.spec.ts': "import './page'; const TestBed = {};",
  });
  for (const changed of ['src/page.html', 'src/page.css', 'src/deleted.ts']) assert.deepEqual(names(affectedTests(root, [changed])), ['src/page.spec.ts']);
});
test('includes declaration consumers rather than silently skipping type-only changes', t => {
  const { root } = fixture(t, {
    'src/types.d.ts': 'export interface Row { name: string }',
    'src/generated.d.mts': 'export declare const validate: unknown;',
    'src/generated.mjs': 'export const validate = () => true;',
    'src/service.ts': "import type {Row} from './types'; import {validate} from './generated.mjs';",
    'src/service.spec.ts': "import './service';",
  });
  for (const changed of ['src/types.d.ts', 'src/generated.d.mts']) assert.deepEqual(names(affectedTests(root, [changed])), ['src/service.spec.ts']);
});
test('routes DOM tests to Angular and reports production code without test consumers', t => {
  const { root } = fixture(t, { 'src/pure.spec.ts': 'expect(1).toBe(1);', 'src/dom.spec.ts': 'localStorage.clear();', 'src/new.ts': 'export const n = 1;' });
  assert.deepEqual(testCatalog(root).map(test => test.runner), ['ui', 'unit']);
  assert.deepEqual(affectedTests(root, ['src/new.ts']).uncovered, ['src/new.ts']);
  assert.deepEqual(names(affectedTests(root, ['docs/a.md'])), []);
});
test('treats shared schema/configuration changes conservatively and covers global styles', t => {
  const { root } = fixture(t, { 'src/a.spec.ts': 'const TestBed = {};', 'src/b.spec.ts': 'const value = 1;', 'src/styles.css': 'body {}' });
  for (const file of ['package.json', 'angular.json', 'tsconfig.spec.json', 'schemas/content/item.json']) assert.equal(affectedTests(root, [file]).tests.length, 2);
  assert.deepEqual(names(affectedTests(root, ['src/styles.css'])), ['src/a.spec.ts']);
});
test('the quick group exists, stays Node-only and retains core persistence/casting checks', () => {
  const catalog = testCatalog();
  for (const file of quickTests) assert.equal(catalog.find(test => test.file === file)?.runner, 'unit', file);
  for (const part of ['session-rules', 'casting-rules', 'character-sync-engine', 'local-editor']) assert(quickTests.some(file => file.includes(part)));
});
test('schema caching detects changed inputs, edited outputs and missing files by contents', t => {
  const { root, write } = fixture(t, { 'input.json': 'one', 'validator.mjs': 'first' });
  const check = () => generatedSchemasCurrent(root, ['input.json'], ['validator.mjs'], 'stamp.json');
  assert.equal(check().current, false);
  const hash = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
  write('stamp.json', JSON.stringify({ fingerprint: check().fingerprint, outputs: { 'validator.mjs': hash('validator.mjs') } }));
  assert.equal(check().current, true);
  write('input.json', 'two'); utimesSync(path.join(root, 'input.json'), 0, 0);
  assert.equal(check().current, false);
  write('input.json', 'one'); write('validator.mjs', 'other');
  assert.equal(check().current, false);
  rmSync(path.join(root, 'validator.mjs'));
  assert.equal(check().current, false);
});
