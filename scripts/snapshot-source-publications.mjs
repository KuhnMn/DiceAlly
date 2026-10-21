import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Maintenance only: node scripts/snapshot-source-publications.mjs E:/5etools-src
const checkout = process.argv[2];
if (!checkout) throw new Error('Pass the reviewed local 5etools-src checkout.');
const root = path.resolve(checkout);
const gitPath = root.replaceAll('\\', '/');
const commit = execFileSync('git', ['-c', `safe.directory=${gitPath}`, '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const publications = new Map();
const provenance = [];
for (const [file, kind] of [['books.json', 'book'], ['adventures.json', 'adventure']]) {
  const bytes = await readFile(path.join(root, 'data', file));
  provenance.push(`// data/${file} SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`);
  for (const entry of JSON.parse(bytes)[kind]) {
    if (typeof entry.source !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.published)) throw new Error(`Invalid publication metadata in ${file}.`);
    const source = entry.source.toLowerCase();
    if (publications.has(source) && publications.get(source) !== entry.published) throw new Error(`Conflicting publication dates for ${entry.source}.`);
    publications.set(source, entry.published);
  }
}
const dates = Object.fromEntries([...publications].sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0));
await writeFile('src/app/content/source-publications.ts', [
  `// Reviewed publication metadata from 5etools-src ${commit}.`, ...provenance,
  '// Update from the same source revision when reviewing new publications. No runtime date lookup.',
  `export const SOURCE_PUBLICATION_DATES: Readonly<Record<string, string>> = ${JSON.stringify(dates, null, 2)};`, '',
].join('\n'));
