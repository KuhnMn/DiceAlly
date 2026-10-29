import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { filesUnder, testCatalog } from './test-catalog.mjs';

export function affectedTests(root, changed) {
  const tests = testCatalog(root);
  const broad = changed.some(file => /^(package(?:-lock)?\.json|angular\.json|tsconfig[^/]*\.json|vitest[^/]*\.mjs)$/.test(file) || file.startsWith('schemas/'));
  if (broad) return { tests, reason: 'Shared configuration or schema changed.', uncovered: [] };
  const files = filesUnder(root, 'src');
  const known = new Set([...files, ...changed]);
  const reverse = new Map();
  const connect = (dependency, consumer) => {
    if (!reverse.has(dependency)) reverse.set(dependency, new Set());
    reverse.get(dependency).add(consumer);
  };
  for (const file of files) {
    if (!/\.(?:[cm]?ts|css)$/.test(file)) continue;
    const source = readFileSync(path.join(root, file), 'utf8');
    const references = [];
    if (!file.endsWith('.css')) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      // Includes imports, dynamic imports, worker URLs, templates and style URLs.
      const visit = node => {
        if (ts.isStringLiteralLike(node) && node.text.startsWith('.')) references.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    } else for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) references.push(match[1]);
    for (const reference of references) {
      const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), reference));
      const dependency = [candidate, `${candidate}.ts`, `${candidate}.d.ts`, `${candidate}.mts`, `${candidate}/index.ts`, `${candidate}/index.d.ts`].find(value => known.has(value));
      if (dependency) connect(dependency, file);
      const declaration = candidate.endsWith('.mjs') ? candidate.slice(0, -4) + '.d.mts' : candidate.endsWith('.js') ? candidate.slice(0, -3) + '.d.ts' : undefined;
      if (declaration && known.has(declaration)) connect(declaration, file);
    }
  }
  const reached = new Set(changed), queue = [...changed];
  for (let i = 0; i < queue.length; i++) for (const consumer of reverse.get(queue[i]) ?? []) {
    if (!reached.has(consumer)) { reached.add(consumer); queue.push(consumer); }
  }
  const globalStyles = reached.has('src/styles.css');
  const selected = tests.filter(test => reached.has(test.file) || (globalStyles && test.runner === 'ui'));
  return { tests: selected, reason: 'Changed files and their transitive consumers.',
    uncovered: changed.filter(file => file.startsWith('src/') && !selected.some(test => reaches(file, test.file, reverse))) };
}
function reaches(start, target, reverse) {
  const seen = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    if (queue[i] === target) return true;
    for (const next of reverse.get(queue[i]) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return false;
}
