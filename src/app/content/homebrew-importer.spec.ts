import 'fake-indexeddb/auto';
import { IndexedDbContentCache } from './content-cache';
import { mapContent } from './content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { importHomebrew } from './homebrew-importer';
import { readHomebrewFile } from './homebrew-package';
import { finalizeContentImport } from './content-finalizer';
import { spellClassMemberships } from './spell-membership';
import { importContent } from './content-importer';

async function fixture() {
  const cache = new IndexedDbContentCache();
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: `homebrew-${crypto.randomUUID()}` };
  const base: ImportRevision = {
    id: crypto.randomUUID(), namespace: 'homebrew-tests', source, sourceIdentity: sourceIdentity(source),
    commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, createdAt: new Date().toISOString(),
    status: 'staging', files: ['core.json'], diagnostics: [],
    metrics: { bytes: 0, records: 0, mappedBytes: 0, elapsedMs: 0 },
  };
  await cache.stage(base);
  await cache.put(base.id, mapContent({
    race: [{ name: 'Core Human', source: 'PHB', speed: 30 }],
    spell: [{ name: 'Core Spell', source: 'PHB', level: 1, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } }],
  }, 'core.json').records);
  await finalizeContentImport(cache, base, { bytes: 0, started: performance.now() });
  return { cache, base, source, namespace: base.namespace };
}

function document(name = 'Homebrew Spell') {
  return {
    _meta: { sources: [{ json: 'BREW', full: 'A Selected Book' }] },
    spell: [{ name, source: 'BREW', level: 0, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } }],
    race: [{ name: 'Homebrew Species', source: 'BREW', speed: 25, entries: ['A trait'] }],
  };
}

describe('Explicit single-file homebrew imports', () => {
  it('removes one homebrew file atomically while retaining core and other selected files', async () => {
    const f = await fixture();
    const first = await readHomebrewFile(document('First Spell'), 'first.json');
    const second = await readHomebrewFile({ spell: [{ name: 'Second Spell', source: 'SECOND', level: 1 }] }, 'second.json');
    const installed = await importHomebrew(f.cache, { ...f, file: first, bytes: 100 });
    const both = await importHomebrew(f.cache, { ...f, base: installed, file: second, bytes: 100 });
    const removed = await importHomebrew(f.cache, { ...f, base: both, removeFileId: first.id, bytes: 0 });
    expect(removed.homebrewFiles!.map(file => file.id)).toEqual([second.id]);
    expect((await f.cache.category(removed.id, 'spell')).map(record => record.name).sort()).toEqual(['Core Spell', 'Second Spell']);
    expect((await f.cache.category(removed.id, 'species')).map(record => record.name)).toEqual(['Core Human']);
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(removed.id);
    // Prior snapshots remain available; removal does not mutate old revisions or character documents.
    expect((await f.cache.category(both.id, 'spell')).some(record => record.name === 'First Spell')).toBe(true);
    await expect(importHomebrew(f.cache, { ...f, base: removed, removeFileId: first.id, bytes: 0 })).rejects.toThrow('no longer installed');
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(removed.id);
  });
  it('keeps homebrew dependency warnings nonfatal when core recipes generate magic weapons on reimport', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({ baseitem: [
      { name: 'Homebrew Gun', source: 'BREW', weapon: true, dmgType: 'P', property: ['GC:VSS-F|ValdaGunslinger'] },
      { name: 'Incomplete Gun', source: 'BREW', weapon: true },
    ] }, 'weapons.json');
    const updated = await importContent(f.cache, {
      namespace: f.namespace, source: f.source, homebrewFiles: [file],
    }, async url => {
      let value: unknown = { feat: [] };
      if (url.startsWith('https://api.github.com/')) value = { sha: 'c'.repeat(40) };
      else if (url.endsWith('/index.json')) value = { CORE: 'core.json' };
      else if (url.endsWith('/spells/sources.json')) value = {};
      else if (url.endsWith('/items-base.json')) value = { baseitem: [{ name: 'Core Sword', source: 'PHB', weapon: true, dmgType: 'S' }] };
      else if (url.endsWith('/magicvariants.json')) value = { magicvariant: [{ name: 'Vicious Weapon', source: 'DMG', requires: [{ weapon: true }],
        inherits: { source: 'DMG', namePrefix: 'Vicious ', entries: ['Deals {=dmgType} damage.'] } }] };
      return { value, bytes: 1 };
    });
    expect(updated.status).toBe('ready');
    expect(updated.diagnostics.some(issue => issue.severity === 'error')).toBe(false);
    expect(updated.diagnostics.some(issue => issue.message.includes('GC:VSS-F|ValdaGunslinger') && issue.file.startsWith('homebrew/'))).toBe(true);
    expect(updated.diagnostics.some(issue => issue.message.includes('Incomplete Gun + Vicious Weapon'))).toBe(true);
    const items = await f.cache.category(updated.id, 'item');
    expect(items.some(item => item.name === 'Vicious Core Sword')).toBe(true);
    expect(items.some(item => item.name === 'Vicious Homebrew Gun' && item.file.startsWith('homebrew/'))).toBe(true);
    expect(items.some(item => item.name === 'Incomplete Gun')).toBe(true);
    expect(items.some(item => item.name === 'Vicious Incomplete Gun')).toBe(false);
  });
  it('retains explicitly selected files through a core-library reimport', async () => {
    const f = await fixture();
    const brew = await importHomebrew(f.cache, { ...f, file: await readHomebrewFile(document(), 'selected.json'), bytes: 100 });
    const updated = await importContent(f.cache, {
      namespace: f.namespace, source: f.source, homebrewFiles: brew.homebrewFiles,
    }, async url => {
      let value: unknown = { feat: [] };
      if (url.startsWith('https://api.github.com/')) value = { sha: 'b'.repeat(40) };
      else if (url.endsWith('/index.json')) value = { CORE: 'core.json' };
      else if (url.endsWith('/spells/sources.json')) value = {};
      else if (url.endsWith('/spells/core.json')) value = { spell: [{ name: 'Updated Core Spell', source: 'PHB', level: 1 }] };
      return { value, bytes: 1 };
    });
    expect(updated.commit).toBe('b'.repeat(40));
    expect(updated.homebrewFiles).toHaveLength(1);
    expect((await f.cache.category(updated.id, 'spell')).map(record => record.name).sort()).toEqual(['Homebrew Spell', 'Updated Core Spell']);
    expect((await f.cache.category(updated.id, 'species'))[0].name).toBe('Homebrew Species');
  });
  it('merges compatible supplemental duplicates and retains conflicting definitions as labeled alternatives', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({ spell: [
      { name: 'Arc Blade', source: 'BREW', level: 0, miscTags: ['AAD', 'SCL'], classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
      { name: 'Arc Blade', source: 'BREW', level: 0, miscTags: ['SCL'] },
    ] }, 'duplicates.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 10 });
    const records = await f.cache.category(result.id, 'spell');
    expect(records.filter(record => record.name === 'Arc Blade')).toHaveLength(1);
    expect(records.find(record => record.name === 'Arc Blade')!.data['miscTags']).toEqual(['AAD', 'SCL']);
    const conflicting = await readHomebrewFile({ spell: [
      { name: 'Arc Blade', source: 'BREW', level: 0 }, { name: 'Arc Blade', source: 'BREW', level: 1 },
    ] }, 'duplicates.json');
    const changed = await importHomebrew(f.cache, { ...f, base: result, file: conflicting, bytes: 10 });
    const alternatives = (await f.cache.category(changed.id, 'spell')).filter(record => record.publication === 'BREW');
    expect(alternatives.map(record => record.name)).toEqual(['Arc Blade (Alternative 1)', 'Arc Blade (Alternative 2)']);
    expect(alternatives.map(record => record.data['level'])).toEqual([0, 1]);
    expect(changed.diagnostics.some(issue => issue.message.includes('Conflicting duplicate'))).toBe(true);
  });
  it('adds inline spell classes and materialized species while retaining core records and stable source identity', async () => {
    const f = await fixture();
    const file = await readHomebrewFile(document(), 'selected.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 100 });
    expect(result.sourceIdentity).toBe(f.base.sourceIdentity); expect(result.commit).toBe(f.base.commit);
    expect((await f.cache.category(result.id, 'species')).map(record => record.name).sort()).toEqual(['Core Human', 'Homebrew Species']);
    const spell = (await f.cache.category(result.id, 'spell')).find(record => record.publication === 'BREW')!;
    expect(spellClassMemberships(spell.data['classes']).map(entry => entry.name)).toEqual(['Wizard']);
    expect(result.homebrewFiles![0].sources).toEqual(['BREW']);
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(result.id);
  });

  it('updates the same file without duplicates, removes its obsolete entries and retains another selected file', async () => {
    const f = await fixture();
    const first = await importHomebrew(f.cache, { ...f, file: await readHomebrewFile(document(), 'selected.json'), bytes: 100 });
    const other = await importHomebrew(f.cache, { ...f, base: first,
      file: await readHomebrewFile({ feat: [{ name: 'Other Feat', source: 'OTHER' }] }, 'other.json'), bytes: 50 });
    const updated = await importHomebrew(f.cache, { ...f, base: other,
      file: await readHomebrewFile({ spell: [{ name: 'Replacement', source: 'BREW', level: 1 }] }, 'selected.json'), bytes: 30 });
    expect(updated.homebrewFiles).toHaveLength(2);
    expect((await f.cache.category(updated.id, 'spell')).map(record => record.name).sort()).toEqual(['Core Spell', 'Replacement']);
    expect((await f.cache.category(updated.id, 'species')).map(record => record.name)).toEqual(['Core Human']);
    expect((await f.cache.category(updated.id, 'feat'))[0].name).toBe('Other Feat');
  });

  it('reports missing external dependencies without fetching them or hiding available spells', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({
      _meta: { sources: [{ json: 'BREW' }], dependencies: { class: ['OTHER'] } },
      subclass: [{ name: 'External Subclass', source: 'BREW', className: 'Missing Class', classSource: 'OTHER' }],
      spell: [{ name: 'Available Spell', source: 'BREW', level: 1 }],
    }, 'dependent.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 10 });
    expect(result.diagnostics.some(issue => issue.severity === 'warning' && issue.message.includes('parent-class'))).toBe(true);
    expect((await f.cache.category(result.id, 'spell')).some(record => record.name === 'Available Spell')).toBe(true);
  });

  it('preserves the active library on malformed data, collisions and cancellation', async () => {
    const f = await fixture();
    const invalid = await readHomebrewFile({ spell: 'invalid' }, 'invalid.json');
    await expect(importHomebrew(f.cache, { ...f, file: invalid, bytes: 1 })).rejects.toThrow('must be an array');
    const collision = await readHomebrewFile({ spell: [{ name: 'Core Spell', source: 'PHB', level: 1 }] }, 'collision.json');
    await expect(importHomebrew(f.cache, { ...f, file: collision, bytes: 1 })).rejects.toThrow('duplicate content identity');
    const controller = new AbortController();
    await expect(importHomebrew(f.cache, { ...f, file: await readHomebrewFile(document(), 'cancel.json'), bytes: 1,
      signal: controller.signal, progress: () => controller.abort() })).rejects.toThrow();
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
    expect((await f.cache.revisions(f.namespace)).filter(entry => entry.revision.status === 'staging')).toHaveLength(0);
  });
});
