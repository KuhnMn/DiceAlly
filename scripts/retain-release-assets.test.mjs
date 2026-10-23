import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retainReleaseAssets } from './retain-release-assets.mjs';

test('retains old lazy dependencies for two releases while keeping current HTML/config and pruning older assets', () => {
  let previous = { 'index.html': Buffer.from('old index'), 'runtime-config.js': Buffer.from('old config'), 'chunk-OLD.js': Buffer.from('old module') };
  for (const [current, expected] of [['FIRST', ['FIRST', 'OLD']], ['SECOND', ['SECOND', 'FIRST', 'OLD']], ['THIRD', ['THIRD', 'SECOND', 'FIRST']]]) {
    const directory = mkdtempSync(path.join(tmpdir(), 'diceally-release-'));
    try {
      writeFileSync(path.join(directory, `chunk-${current}.js`), 'current module');
      writeFileSync(path.join(directory, 'index.html'), 'current index');
      writeFileSync(path.join(directory, 'runtime-config.js'), 'current config');
      retainReleaseAssets(directory, Object.keys(previous), name => previous[name]);
      assert.deepEqual(readdirSync(directory).filter(name => name.endsWith('.js') && name.startsWith('chunk')).sort(), expected.map(name => `chunk-${name}.js`).sort());
      assert.equal(readFileSync(path.join(directory, 'index.html'), 'utf8'), 'current index');
      assert.equal(readFileSync(path.join(directory, 'runtime-config.js'), 'utf8'), 'current config');
      previous = Object.fromEntries(readdirSync(directory).map(name => [name, readFileSync(path.join(directory, name))]));
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

test('rejects paths outside the output directory in a deployed manifest', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'diceally-release-'));
  try {
    const previous = { 'release-assets.json': Buffer.from(JSON.stringify({ current: ['../escape.js'], previous: [] })) };
    assert.throws(() => retainReleaseAssets(directory, Object.keys(previous), name => previous[name]), /Invalid retained asset path/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
