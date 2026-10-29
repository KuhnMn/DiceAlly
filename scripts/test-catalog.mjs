import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const quickTests = [
  'src/app/search-ranking.spec.ts',
  'src/app/auth/auth-error.spec.ts',
  'src/app/loading/lazy-load.spec.ts',
  'src/app/models/character-speed.spec.ts',
  'src/app/editor/editor-identity.spec.ts',
  'src/app/rules/ability-rules.spec.ts',
  'src/app/rules/document-operations.spec.ts',
  'src/app/editor/local-editor.spec.ts',
  'src/app/characters/portable-character.spec.ts',
  'src/app/rules/level-rules.spec.ts',
  'src/app/rules/progression-stats.spec.ts',
  'src/app/rules/session-rules.spec.ts',
  'src/app/rules/casting-rules.spec.ts',
  'src/app/rules/resource-action-rules.spec.ts',
  'src/app/rules/spell-usage.spec.ts',
  'src/app/characters/sync/character-sync-engine.spec.ts',
];

export function filesUnder(root, directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(root, relative) : [relative];
  }).sort();
}

/** Tests requiring Angular's template compiler or a DOM stay with the Angular runner. */
export function testCatalog(root = process.cwd()) {
  return filesUnder(root, 'src').filter(file => file.endsWith('.spec.ts')).map(file => {
    const source = readFileSync(path.join(root, file), 'utf8');
    const ui = /\bTestBed\b|@angular\/core\/testing|document\.(?:createElement|body)|\bwindow\.|\bHTMLElement\b|\blocalStorage\b|\bsessionStorage\b|\bStorage\.prototype/.test(source);
    return { file, runner: ui ? 'ui' : 'unit' };
  });
}
