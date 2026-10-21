import { readHomebrewFile } from './homebrew-package';
import { ContentCache } from './content-cache';
import { featureReference, mapContent } from './content-adapter';
import { importContent } from './content-importer';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, entityKey, ImportRevision } from './content.model';
import { FetchContent } from './github-source';
import { discoverFiles, ROOT_FILES } from './content-discovery';
import { spellRecordClasses } from './spell-adapter';
import { coreDocumentFixture, homebrewDocumentFixture } from './content-fixtures.testing';
import { validateCoreDocument, validateHomebrewDocument } from './content-schema';

class MemoryCache implements ContentCache {
  revisions = new Map<string, Map<string, ContentRecord>>();
  active = 'old-revision';
  async stage(r: ImportRevision) { this.revisions.set(r.id, new Map()); }
  async put(id: string, records: ContentRecord[]) { for (const r of records) this.revisions.get(id)!.set(r.key, r); }
  async get(id: string, key: string) { return this.revisions.get(id)?.get(key); }
  async visit(id: string, visitor: (r: ContentRecord) => Promise<void>) { for (const r of this.revisions.get(id)!.values()) await visitor(r); }
  async activate(r: ImportRevision, signal?: AbortSignal) { signal?.throwIfAborted(); this.active = r.id; }
  async discard(id: string) { this.revisions.delete(id); }
}
const commit = 'a'.repeat(40);
function fixture(overrides: Record<string, unknown> = {}, urls: string[] = []): FetchContent {
  return async (url, signal) => {
    signal?.throwIfAborted(); urls.push(url);
    if (url.startsWith('https://api.github.com/')) return { value: { sha: commit }, bytes: 10 };
    const file = url.split(`/${commit}/data/`)[1];
    const value = file.endsWith('/index.json')
      ? overrides[file] ?? { TEST: `${file.split('/')[0]}-test.json` }
      : coreDocumentFixture(file, overrides[file] as Record<string, unknown> | undefined);
    return { value, bytes: JSON.stringify(value).length };
  };
}
describe('Content importer', () => {
  beforeAll(async () => {
    await validateCoreDocument(coreDocumentFixture('feats.json'), 'feats.json');
    await validateHomebrewDocument(homebrewDocumentFixture({}), 'fixture.json');
  }, 30000);
  it('persists the agreed reference categories and reports excluded roots', async () => {
    const cache = new MemoryCache();
    const revision = await importContent(cache, { namespace: 'reference-content', source: DEFAULT_CONTENT_SOURCE }, fixture());
    for (const [kind, file, name] of [
      ['condition', 'conditionsdiseases.json', 'conditionsdiseases.json'],
      ['status', 'conditionsdiseases.json', 'Fixture Status'],
      ['variantrule', 'variantrules.json', 'variantrules.json'],
      ['action', 'actions.json', 'actions.json'], ['facility', 'bastions.json', 'bastions.json'],
      ['disease', 'conditionsdiseases.json', 'Fixture Disease'], ['object', 'objects.json', 'objects.json'],
      ['sense', 'senses.json', 'senses.json'], ['skill', 'skills.json', 'skills.json'],
      ['vehicle', 'vehicles.json', 'vehicles.json'],
    ]) {
      const record = await cache.get(revision.id, entityKey(kind, { name, source: 'TEST' }));
      expect(record?.kind).toBe(kind);
      expect(record?.file).toBe(file);
      expect(record?.referenceDefinition).toMatchObject({ kind, version: 1, name });
      expect(record?.data).toEqual({});
    }
    expect(revision.schemaSnapshot).toMatch(/^[a-f0-9]{64}$/);
    expect(revision.diagnostics.some(issue => issue.code === 'unsupported-category' && issue.path === '/vehicleUpgrade')).toBe(true);
  });
  it('rejects malformed later files before storing their records and retains the active revision', async () => {
    const cache = new MemoryCache();
    try {
      await importContent(cache, { namespace: 'invalid-action', source: DEFAULT_CONTENT_SOURCE }, fixture({
        'actions.json': { action: [{ name: 'Broken', source: 'TEST', page: '1', entries: [] }] },
      }));
      throw new Error('Expected schema validation to fail.');
    } catch (error) {
      expect(error).toHaveProperty('diagnostics', expect.arrayContaining([
        expect.objectContaining({ code: 'schema-invalid', file: 'actions.json', path: '/action/0/page', phase: 'validate' }),
      ]));
    }
    expect(cache.active).toBe('old-revision');
    expect(cache.revisions.size).toBe(0);
  });
  it('downloads backgrounds from the original source and retains entries and structured proficiency choices', async () => {
    const cache = new MemoryCache(), urls: string[] = [];
    const revision = await importContent(cache, { namespace: 'backgrounds', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'backgrounds.json': { background: [{ name: 'Sage', source: 'TEST', entries: ['A background.'], skillProficiencies: [{ arcana: true, choose: { from: ['history', 'religion'], count: 1 } }] }] },
    }, urls));
    const background = await cache.get(revision.id, entityKey('background', { name: 'Sage', source: 'TEST' }));
    expect(urls.some(url => url.endsWith('/data/backgrounds.json'))).toBe(true);
    expect(background!.data['entries']).toEqual(['A background.']);
    expect(background!.characterOption?.proficiencies.skills).toEqual([{ arcana: true, choose: { from: ['history', 'religion'], count: 1 } }]);
  });
  it('reads sources.json class lists scoped to source book and spell name', async () => {
    const cache = new MemoryCache();
    const revision = await importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'spells/spells-test.json': { spell: [
        { name: 'Shield', source: 'TEST', level: 1 },
        { name: 'Shield', source: 'OTHER', level: 1 },
        { name: 'Minor Lifesteal', source: 'ValdaSpire24', level: 0 },
      ] },
      'spells/sources.json': {
        TEST: { Shield: { class: [{ name: 'Wizard', source: 'XPHB' }], classVariant: [{ name: 'Sorcerer', source: 'XPHB', definedInSource: 'TCE' }] } },
        OTHER: { Shield: { class: [{ name: 'Bard', source: 'XPHB' }] } },
        ValdaSpire24: { 'Minor Lifesteal': { class: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Witch', source: 'ValdaWitch' }, { name: 'Necromancer', source: 'ValdaNecromancer' }] } },
      },
    }));
    const membership = async (name: string, source: string) => spellRecordClasses(
      (await cache.get(revision.id, entityKey('spell', { name, source })))!);
    expect((await membership('Shield', 'TEST')).map(entry => entry.name)).toEqual(['Wizard', 'Sorcerer']);
    expect((await membership('Shield', 'OTHER')).map(entry => entry.name)).toEqual(['Bard']);
    expect((await membership('Minor Lifesteal', 'ValdaSpire24')).map(entry => entry.name).sort()).toEqual(['Necromancer', 'Witch', 'Wizard']);
  });

  it('does not activate content with a missing fixed spell grant', async () => {
    const cache = new MemoryCache();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'feats.json': { feat: [{ name: 'Gift', source: 'TEST', additionalSpells: [{ known: { '1': ['Missing|TEST'] } }] }] },
    }))).rejects.toThrow('Content validation failed');
    expect(cache.active).toBe('old-revision'); expect(cache.revisions.size).toBe(0);
  });
  it('pins every downloaded file and activates only after links resolve', async () => {
    const cache = new MemoryCache(); const urls: string[] = [];
    const revision = await importContent(cache, { namespace: 'user-one', source: DEFAULT_CONTENT_SOURCE }, fixture({}, urls));
    expect(cache.active).toBe(revision.id);
    expect(urls.slice(1).every(url => url.includes(`/${commit}/data/`))).toBe(true);
    const mage = await cache.get(revision.id, entityKey('class', { name: 'Mage', source: 'TEST' }));
    expect(mage?.links).toHaveLength(1);
    expect(revision.metrics.records).toBeGreaterThan(0);
    expect(urls.some(url => url.endsWith('bestiary/template.json'))).toBe(false);
  });
  it('retains the previous active revision and removes staging on missing required links', async () => {
    const cache = new MemoryCache();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'class/class-test.json': { class: [{ name: 'Mage', source: 'TEST', classFeatures: ['Missing|Mage|TEST|1'] }] },
    }))).rejects.toThrow('Content validation failed');
    expect(cache.active).toBe('old-revision'); expect(cache.revisions.size).toBe(0);
  });
  it('retains the previous revision on cancelled import', async () => {
    const cache = new MemoryCache(); const controller = new AbortController();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE, signal: controller.signal,
      progress: p => { if (p.phase === 'download') controller.abort(); },
    }, fixture())).rejects.toThrow();
    expect(cache.active).toBe('old-revision'); expect(cache.revisions.size).toBe(0);
  });
  it('resolves plain copies but refuses unsupported modifications', async () => {
    const cache = new MemoryCache();
    const file = ROOT_FILES[0];
    const revision = await importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({ [file]: {
      feat: [{ name: 'Base', source: 'TEST', entries: ['synthetic'] }, { name: 'Child', source: 'TEST', _copy: { name: 'Base', source: 'TEST' } }],
    } }));
    expect((await cache.get(revision.id, entityKey('feat', { name: 'Child', source: 'TEST' })))?.data['entries']).toEqual(['synthetic']);
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({ [file]: {
      feat: [{ name: 'Base', source: 'TEST' }, { name: 'Child', source: 'TEST', _copy: { name: 'Base', source: 'TEST', _mod: { entries: { mode: 'unsupported' } } } }],
    } }))).rejects.toThrow('Content validation failed');
    expect(cache.active).toBe(revision.id);
  });
  it('reports collisions instead of silently choosing one', async () => {
    const cache = new MemoryCache();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({ 'feats.json': {
      feat: [{ name: 'Same', source: 'TEST' }, { name: 'same', source: 'test' }],
    } }))).rejects.toThrow('Content validation failed');
  });
  it('keeps feature identities separate by class and level and retains unknown fields', () => {
    const mapped = mapContent({ classFeature: [
      { name: 'Ability', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 1, future: { choice: true } },
      { name: 'Ability', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 3 },
    ] }, 'class/test.json');
    expect(mapped.records[0].key).not.toBe(mapped.records[1].key);
    expect(mapped.records[0].data['future']).toEqual({ choice: true });
  });
  it('rejects unsafe discovery paths and malformed feature references', async () => {
    await expect(discoverFiles(DEFAULT_CONTENT_SOURCE, commit, fixture({ 'class/index.json': { BAD: '../bad.json' } }))).rejects.toThrow();
    expect(() => featureReference('Broken|Mage|TEST|oops', 'classFeature', {})).toThrow();
  });
  it('uses upstream PHB defaults for omitted source tokens rather than the selected parent edition', () => {
    const link = featureReference('Ability|Mage||1', 'classFeature', { source: 'XPHB' });
    expect(link.target).toBe(entityKey('classFeature', { name: 'Ability', source: 'PHB', className: 'Mage', classSource: 'PHB', level: 1 }));
  });
  it('distinguishes item abbreviations and variant inherited publications', () => {
    expect(entityKey('itemType', { name: 'Vehicle', abbreviation: 'AIR', source: 'TEST' })).not.toBe(entityKey('itemType', { name: 'Vehicle', abbreviation: 'SEA', source: 'TEST' }));
    expect(entityKey('magicvariant', { name: 'Variant', inherits: { source: 'OLD' } })).not.toBe(entityKey('magicvariant', { name: 'Variant', inherits: { source: 'NEW' } }));
  });
  it('loads pinned external templates and resolves copied template definitions before activation', async () => {
    const cache = new MemoryCache(); const urls: string[] = [];
    const revision = await importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'bestiary/bestiary-test.json': { monster: [
        { name: 'Base', source: 'TEST', cr: '3', wis: 14, size: ['M'], senses: ['darkvision 120 ft.'] },
        { name: 'Variant', source: 'TEST', speed: { walk: 40 }, _copy: { name: 'Base', source: 'TEST', _templates: [{ name: 'Copied Template', source: 'TEST' }] } },
      ] },
      'bestiary/template.json': { monsterTemplate: [
        { name: 'Base Template', source: 'TEST', apply: { _root: { size: ['S'], speed: { walk: 25 } }, _mod: {
          _: { mode: 'addSenses', senses: { type: 'darkvision', range: 60 } },
          trait: { mode: 'appendArr', items: { name: 'Synthetic', entries: ['<$title_short_name$> has DC <$spell_dc__wis$>.'] } },
        } } },
        { name: 'Copied Template', source: 'TEST', _copy: { name: 'Base Template', source: 'TEST' } },
      ] },
    }, urls));
    const monster = await cache.get(revision.id, entityKey('monster', { name: 'Variant', source: 'TEST' }));
    expect(monster?.monsterDefinition?.size).toEqual(['S']);
    expect(monster?.monsterDefinition?.speed).toEqual({ walk: 40 });
    expect(monster?.monsterDefinition?.senses).toEqual(['darkvision 120 ft.']);
    expect(monster?.data['trait']).toEqual([{ name: 'Synthetic', entries: ['The variant has DC 12.'] }]);
    expect(urls).toContain(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/data/bestiary/template.json`);
    expect(cache.active).toBe(revision.id);
  });
  it('reports a missing named template and retains the installed revision', async () => {
    const cache = new MemoryCache();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'bestiary/bestiary-test.json': { monster: [{ name: 'Base', source: 'TEST' },
        { name: 'Variant', source: 'TEST', _copy: { name: 'Base', source: 'TEST', _templates: [{ name: 'Missing', source: 'TEST' }] } }] },
      'bestiary/template.json': { monsterTemplate: [{ name: 'Other', source: 'TEST', apply: {} }] },
    }))).rejects.toThrow('Content validation failed');
    expect(cache.active).toBe('old-revision');
    expect(cache.revisions.size).toBe(0);
  });
  it('does not activate a revision with failed secondary item mapping', async () => {
    const cache = new MemoryCache();
    await expect(importContent(cache, { namespace: 'one', source: DEFAULT_CONTENT_SOURCE }, fixture({
      'items.json': { item: [{ name: 'Broken item', source: 'TEST', type: 'Missing|TEST' }] },
    }))).rejects.toThrow('Content validation failed');
    expect(cache.active).toBe('old-revision');
    expect(cache.revisions.size).toBe(0);
  });
  it('discovers core templates required only by retained homebrew during a full reimport', async () => {
    const cache = new MemoryCache(); const urls: string[] = [];
    const file = await readHomebrewFile(homebrewDocumentFixture({ monster: [{
      name: 'Brew Variant', source: 'TESTBREW',
      _copy: { name: 'Base', source: 'TEST', _templates: [{ name: 'Large', source: 'TEST' }] },
    }] }), 'retained.json');
    const revision = await importContent(cache, { namespace: 'retained-template', source: DEFAULT_CONTENT_SOURCE, homebrewFiles: [file] }, fixture({
      'bestiary/bestiary-test.json': { monster: [{ name: 'Base', source: 'TEST', size: ['M'], type: 'humanoid' }] },
      'bestiary/template.json': { monsterTemplate: [{ name: 'Large', source: 'TEST', apply: { _root: { size: ['L'] } } }] },
    }, urls));
    expect(urls.some(url => url.endsWith('bestiary/template.json'))).toBe(true);
    const copy = await cache.get(revision.id, entityKey('monster', { name: 'Brew Variant', source: 'TESTBREW' }));
    expect(copy?.monsterDefinition?.size).toEqual(['L']);
    expect(revision.files).toContain('bestiary/template.json');
  });

});
