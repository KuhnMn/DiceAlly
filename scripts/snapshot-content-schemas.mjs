// Explicit maintenance command. Normal builds/imports never access an upstream checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { schemaFiles, snapshotDirectory, externalSchema } from './content-schema-config.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/snapshot-content-schemas.mjs <5etools-utils checkout>');
const upstream = path.resolve(source);
const commit = execFileSync('git', ['-c', `safe.directory=${upstream.replaceAll('\\', '/')}`, '-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
execFileSync('git', ['-c', `safe.directory=${upstream.replaceAll('\\', '/')}`, '-C', upstream, 'diff', '--exit-code', 'HEAD', '--', 'schema', 'package.json'], { stdio: 'pipe' });
const pkg = JSON.parse(await readFile(path.join(upstream, 'package.json'), 'utf8'));
const manifest = { repository: pkg.repository.url, commit, packageVersion: pkg.version,
  license: pkg.license, profiles: {} };

for (const profile of ['site', 'brew']) {
  const queue = [...schemaFiles, ...(profile === 'brew' ? ['homebrew.json'] : [])];
  const files = new Map();
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    if (files.has(file)) continue;
    if (file.startsWith('../') || path.posix.isAbsolute(file)) throw new Error(`Escaping schema reference: ${file}`);
    const remote = file.startsWith('https:');
    if (remote && !file.startsWith(externalSchema.prefix)) throw new Error(`Unpinned remote schema reference: ${file}`);
    const origin = remote ? file.replace(externalSchema.prefix, externalSchema.pinnedPrefix) : undefined;
    const response = remote ? await fetch(origin) : undefined;
    if (response && !response.ok) throw new Error(`Schema download failed: ${response.status} ${origin}`);
    const bytes = remote ? Buffer.from(await response.arrayBuffer()) : await readFile(path.join(upstream, 'schema', profile, file));
    const schema = JSON.parse(bytes);
    files.set(file, { bytes, version: schema.version, origin });
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (typeof value.$ref === 'string') {
        const target = value.$ref.split('#')[0];
        if (target) queue.push(/^https:/.test(target) ? target : remote ? new URL(target, file).href : path.posix.normalize(path.posix.join(path.posix.dirname(file), target)));
      }
      Object.values(value).forEach(visit);
    };
    visit(schema);
  }
  manifest.profiles[profile] = {};
  for (const file of [...files.keys()].sort()) {
    const { bytes, version, origin } = files.get(file);
    const localFile = origin ? `external/plutonium-scenes/${file.slice(externalSchema.prefix.length)}` : file;
    const target = path.join(snapshotDirectory, profile, localFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    manifest.profiles[profile][localFile] = { version, sha256: createHash('sha256').update(bytes).digest('hex'),
      ...(origin ? { uri: file, origin, commit: externalSchema.commit } : {}) };
  }
  console.log(`${profile}: ${files.size} pinned schema files`);
}
await writeFile(path.join(snapshotDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
