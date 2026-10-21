import 'fake-indexeddb/auto';
import { IndexedDbContentCache } from './content-cache';
import { mapContent } from './content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { importHomebrew } from './homebrew-importer';
import { readHomebrewFile as parseHomebrewFile } from './homebrew-package';
import { finalizeContentImport } from './content-finalizer';
import { spellDefinition, spellRecordClasses } from './spell-adapter';
import { importContent } from './content-importer';
import { coreDocumentFixture, homebrewDocumentFixture } from './content-fixtures.testing';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { validateHomebrewDocument } from './content-schema';

const readHomebrewFile = (value: Record<string, unknown>, name: string) => parseHomebrewFile(homebrewDocumentFixture(value), name);

async function fixture() {
  const cache = new IndexedDbContentCache();
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: `homebrew-${crypto.randomUUID()}` };
  const base: ImportRevision = {
    id: crypto.randomUUID(), namespace: 'homebrew-tests', source, sourceIdentity: sourceIdentity(source),
    commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, createdAt: new Date().toISOString(),
    schemaSnapshot: CONTENT_SCHEMA_ID,
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
    _meta: { sources: [{ json: 'TESTBREW', full: 'A Selected Book' }] },
    spell: [{ name, source: 'TESTBREW', level: 0, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } }],
    race: [{ name: 'Homebrew Species', source: 'TESTBREW', speed: 25, entries: ['A trait'] }],
  };
}

describe('Explicit single-file homebrew imports', () => {
  beforeAll(async () => validateHomebrewDocument(homebrewDocumentFixture({}), 'fixture.json'), 30000);
  it('stores and expands reusable item entries through import, cache reopen and replay', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({
      itemEntry: [{ name: 'Ring Text', source: 'TESTBREW', entriesTemplate: ['Resistance to {{item.resist}}.'] }],
      item: [{ name: 'Brew Ring', source: 'TESTBREW', rarity: 'unknown', resist: ['fire'], entries: ['{#itemEntry Ring Text|TESTBREW}'] }],
    }, 'templates.json');
    const revision = await importHomebrew(f.cache, { ...f, file, bytes: 1 });
    const items = await new IndexedDbContentCache().category(revision.id, 'item');
    expect(items.find(item => item.name === 'Brew Ring')?.data['entries']).toEqual(['Resistance to fire.']);
    expect(await f.cache.category(revision.id, 'itemEntry')).toHaveLength(1);
    const other = await readHomebrewFile({ feat: [{ name: 'Extra', source: 'TESTBREW', entries: [] }] }, 'other.json');
    const replay = await importHomebrew(f.cache, { ...f, base: revision, file: other, bytes: 1 });
    const ring = (await f.cache.category(replay.id, 'item')).find(item => item.name === 'Brew Ring')!;
    expect(ring.data['entries']).toEqual(['Resistance to fire.']);
    expect(ring.links.filter(link => link.role === 'item-entry')).toHaveLength(1);
  });
  it('keeps the active library when an item template cannot be resolved', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({ item: [{ name: 'Broken Ring', source: 'TESTBREW', rarity: 'unknown', entries: ['{#itemEntry Missing|TESTBREW}'] }] }, 'broken.json');
    await expect(importHomebrew(f.cache, { ...f, file, bytes: 1 })).rejects.toThrow('Content validation failed');
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
  });
  it('requires a core reimport before appending to an old adapter or schema snapshot', async () => {
    const f = await fixture();
    const file = await readHomebrewFile(document(), 'selected.json');
    for (const base of [{ ...f.base, adapterVersion: ADAPTER_VERSION - 1 }, { ...f.base, schemaSnapshot: 'old' }]) {
      await expect(importHomebrew(f.cache, { ...f, base, file, bytes: 1 })).rejects.toThrow('Reimport the content library');
    }
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
  });
  it('rejects appending homebrew to a different branch of the installed library', async () => {
    const f = await fixture();
    const file = await readHomebrewFile(document(), 'selected.json');
    const source = { ...f.source, branch: 'other-branch' };
    await expect(importHomebrew(f.cache, { ...f, source, file, bytes: 1 })).rejects.toThrow('different content library');
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
    expect(await f.cache.active(f.namespace, source)).toBeUndefined();
  });
  it('validates retained homebrew documents again when replaying persisted files', async () => {
    const f = await fixture();
    const file = await readHomebrewFile(document(), 'selected.json');
    file.document['spell'] = 'corrupted after loading';
    await expect(importHomebrew(f.cache, { ...f, file, bytes: 1 })).rejects.toThrow('Content validation failed');
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
    expect((await f.cache.revisions(f.namespace)).some(entry => entry.revision.status === 'staging')).toBe(false);
  });
  it('stores the additional homebrew categories and resolves copied reference definitions', async () => {
    const f = await fixture();
    const definitions: Record<string, unknown> = {};
    for (const [kind, path] of [['condition', 'conditionsdiseases.json'], ['status', 'conditionsdiseases.json'], ['variantrule', 'variantrules.json'], ['action', 'actions.json'], ['facility', 'bastions.json'],
      ['disease', 'conditionsdiseases.json'], ['object', 'objects.json'], ['sense', 'senses.json'],
      ['skill', 'skills.json'], ['vehicle', 'vehicles.json']]) {
      const entries = coreDocumentFixture(path)[kind] as Record<string, unknown>[];
      definitions[kind] = entries.map(entry => ({ ...entry, source: 'TESTBREW' }));
    }
    (definitions['skill'] as Record<string, unknown>[]).push({ name: 'Copied Skill', source: 'TESTBREW',
      _copy: { name: 'skills.json', source: 'TESTBREW' } });
    const file = await readHomebrewFile(definitions, 'references.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 100 });
    for (const kind of Object.keys(definitions)) {
      const rows = await f.cache.category(result.id, kind);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(row => row.file.startsWith('homebrew/') && row.publication === 'TESTBREW')).toBe(true);
      expect(rows.every(row => row.referenceDefinition?.kind === kind && row.referenceDefinition.version === 1)).toBe(true);
      const reopened = await new IndexedDbContentCache().category(result.id, kind);
      expect(reopened).toEqual(rows);
    }
    const copied = (await f.cache.category(result.id, 'skill')).find(row => row.name === 'Copied Skill')!;
    expect(copied.referenceDefinition).toMatchObject({ kind: 'skill', ability: 'wis' });
    expect(copied.data['_copy']).toBeUndefined();
  });
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
      { name: 'Homebrew Gun', source: 'TESTBREW', weapon: true, dmgType: 'P', property: ['GC:VSS-F|ValdaGunslinger'] },
      { name: 'Incomplete Gun', source: 'TESTBREW', weapon: true },
    ] }, 'weapons.json');
    const updated = await importContent(f.cache, {
      namespace: f.namespace, source: f.source, homebrewFiles: [file],
    }, async url => {
      const path = url.split('/data/')[1];
      let value: unknown = path ? coreDocumentFixture(path) : {};
      if (url.startsWith('https://api.github.com/')) value = { sha: 'c'.repeat(40) };
      else if (url.endsWith('/index.json')) value = { CORE: 'core.json' };
      else if (url.endsWith('/items-base.json')) value = coreDocumentFixture('items-base.json', { baseitem: [{ name: 'Core Sword', source: 'PHB', weapon: true, dmgType: 'S' }] });
      else if (url.endsWith('/magicvariants.json')) value = { magicvariant: [{ name: 'Vicious Weapon', requires: [{ weapon: true }],
        inherits: { source: 'DMG', rarity: 'rare', namePrefix: 'Vicious ', entries: ['Deals {=dmgType} damage.'] } }] };
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
      const path = url.split('/data/')[1];
      let value: unknown = path ? coreDocumentFixture(path) : {};
      if (url.startsWith('https://api.github.com/')) value = { sha: 'b'.repeat(40) };
      else if (url.endsWith('/index.json')) value = { CORE: 'core.json' };
      else if (url.endsWith('/spells/core.json')) value = coreDocumentFixture('spells/core.json', { spell: [{ name: 'Updated Core Spell', source: 'PHB', level: 1 }] });
      return { value, bytes: 1 };
    });
    expect(updated.commit).toBe('b'.repeat(40));
    expect(updated.homebrewFiles).toHaveLength(1);
    expect((await f.cache.category(updated.id, 'spell')).map(record => record.name).sort()).toEqual(['Homebrew Spell', 'Updated Core Spell']);
    expect((await f.cache.category(updated.id, 'species')).some(record => record.name === 'Homebrew Species')).toBe(true);
  });
  it('merges compatible supplemental duplicates and retains conflicting definitions as labeled alternatives', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({ spell: [
      { name: 'Arc Blade', source: 'TESTBREW', level: 0, miscTags: ['AAD', 'SCL'], classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
      { name: 'Arc Blade', source: 'TESTBREW', level: 0, miscTags: ['SCL'] },
    ] }, 'duplicates.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 10 });
    const records = await f.cache.category(result.id, 'spell');
    expect(records.filter(record => record.name === 'Arc Blade')).toHaveLength(1);
    expect(records.find(record => record.name === 'Arc Blade')!.data['miscTags']).toEqual(['AAD', 'SCL']);
    const conflicting = await readHomebrewFile({ spell: [
      { name: 'Arc Blade', source: 'TESTBREW', level: 0 }, { name: 'Arc Blade', source: 'TESTBREW', level: 1 },
    ] }, 'duplicates.json');
    const changed = await importHomebrew(f.cache, { ...f, base: result, file: conflicting, bytes: 10 });
    const alternatives = (await f.cache.category(changed.id, 'spell')).filter(record => record.publication === 'TESTBREW');
    expect(alternatives.map(record => record.name)).toEqual(['Arc Blade (Alternative 1)', 'Arc Blade (Alternative 2)']);
    expect(alternatives.map(record => spellDefinition(record).level)).toEqual([0, 1]);
    expect(changed.diagnostics.some(issue => issue.message.includes('Conflicting duplicate'))).toBe(true);
  });
  it('adds inline spell classes and materialized species while retaining core records and stable source identity', async () => {
    const f = await fixture();
    const file = await readHomebrewFile(document(), 'selected.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 100 });
    expect(result.sourceIdentity).toBe(f.base.sourceIdentity); expect(result.commit).toBe(f.base.commit);
    expect((await f.cache.category(result.id, 'species')).map(record => record.name).sort()).toEqual(['Core Human', 'Homebrew Species']);
    const spell = (await f.cache.category(result.id, 'spell')).find(record => record.publication === 'TESTBREW')!;
    expect(spellRecordClasses(spell).map(entry => entry.name)).toEqual(['Wizard']);
    expect(result.homebrewFiles![0].sources).toEqual(['TESTBREW']);
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(result.id);
  });

  it('updates the same file without duplicates, removes its obsolete entries and retains another selected file', async () => {
    const f = await fixture();
    const first = await importHomebrew(f.cache, { ...f, file: await readHomebrewFile(document(), 'selected.json'), bytes: 100 });
    const other = await importHomebrew(f.cache, { ...f, base: first,
      file: await readHomebrewFile({ feat: [{ name: 'Other Feat', source: 'OTHER' }] }, 'other.json'), bytes: 50 });
    const updated = await importHomebrew(f.cache, { ...f, base: other,
      file: await readHomebrewFile({ spell: [{ name: 'Replacement', source: 'TESTBREW', level: 1 }] }, 'selected.json'), bytes: 30 });
    expect(updated.homebrewFiles).toHaveLength(2);
    expect((await f.cache.category(updated.id, 'spell')).map(record => record.name).sort()).toEqual(['Core Spell', 'Replacement']);
    expect((await f.cache.category(updated.id, 'species')).map(record => record.name)).toEqual(['Core Human']);
    expect((await f.cache.category(updated.id, 'feat'))[0].name).toBe('Other Feat');
  });

  it('reports missing external dependencies without fetching them or hiding available spells', async () => {
    const f = await fixture();
    const file = await readHomebrewFile({
      _meta: { sources: [{ json: 'TESTBREW' }], dependencies: { class: ['OTHER'] } },
      subclass: [{ name: 'External Subclass', source: 'TESTBREW', className: 'Missing Class', classSource: 'OTHER' }],
      spell: [{ name: 'Available Spell', source: 'TESTBREW', level: 1 }],
    }, 'dependent.json');
    const result = await importHomebrew(f.cache, { ...f, file, bytes: 10 });
    expect(result.diagnostics.some(issue => issue.severity === 'warning' && issue.message.includes('parent-class'))).toBe(true);
    expect((await f.cache.category(result.id, 'spell')).some(record => record.name === 'Available Spell')).toBe(true);
  });

  it('preserves the active library on malformed data, collisions and cancellation', async () => {
    const f = await fixture();
    await expect(readHomebrewFile({ spell: 'invalid' }, 'invalid.json')).rejects.toThrow('must be array');
    const collision = await readHomebrewFile({ spell: [{ name: 'Core Spell', source: 'PHB', level: 1 }] }, 'collision.json');
    await expect(importHomebrew(f.cache, { ...f, file: collision, bytes: 1 })).rejects.toThrow('duplicate content identity');
    const controller = new AbortController();
    await expect(importHomebrew(f.cache, { ...f, file: await readHomebrewFile(document(), 'cancel.json'), bytes: 1,
      signal: controller.signal, progress: () => controller.abort() })).rejects.toThrow();
    expect((await f.cache.active(f.namespace, f.source))!.id).toBe(f.base.id);
    expect((await f.cache.revisions(f.namespace)).filter(entry => entry.revision.status === 'staging')).toHaveLength(0);
  });
  it('retains different ordered progressions as alternatives instead of merging their value sets', async () => {
    const f = await fixture();
    const first = [1, ...Array(19).fill(2)]; const second = [...Array(19).fill(2), 1];
    const file = await readHomebrewFile({ class: [
      { name: 'Ordered Class', source: 'TESTBREW', spellsKnownProgression: first },
      { name: 'Ordered Class', source: 'TESTBREW', spellsKnownProgression: second },
    ] }, 'ordered.json');
    const revision = await importHomebrew(f.cache, { ...f, file, bytes: 1 });
    const classes = await f.cache.category(revision.id, 'class');
    expect(classes).toHaveLength(2);
    expect(classes.map(record => record.classDefinition?.casting.spellsKnownProgression)).toEqual([first, second]);
    expect(classes.every(record => record.homebrewVariant !== undefined)).toBe(true);
  });

});
