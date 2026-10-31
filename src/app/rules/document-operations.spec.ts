import { mapContent } from '../content/content-adapter';
import { CharacterDocument, parseCharacterDocument, validateCharacterDocument } from './character-document';
import { acceptDocumentPreview, performDocumentAction, performSpellResourceUse, previewContentUpdate, previewDocument } from './document-operations';
function fixture() {
  const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',hd: { number: 1,faces: 6 },casterProgression: 'full',spellcastingAbility: 'int',
    additionalSpells: [{ ability: 'int',innate: { '1': { daily: { '2e': ['Light'] } } } }] }],
    spell: [{ name: 'Light',source: 'PHB',level: 0 }] },'synthetic.json').records;
  const index = { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) };
  const document: CharacterDocument = {
    format: 'ally-character',schemaVersion: 1,id: '11111111-1111-4111-8111-111111111111',rulesVersion: 'android-v1',restPolicy: 'android-v1',
    identity: { name: 'Test',description: '',extra: { kept: true } },
    creation: { classes: { selections: [{ selectionId: 'mage',classKey: records.find(r => r.kind === 'class')!.key,level: 3 }] },
      levels: { manualMaxHp: 1,applyHp: true,applyHitDice: true,manualPools: [] },abilities: { str: 10,dex: 14,con: 14,int: 16,wis: 10,cha: 10 },
      stats: { armor: [],calculateAc: true,manualAc: 10 },manualProficiencies: [],manualSpeciesContributions: [],manualResources: [],manualSources: [],actions: [],pacts: [] },
    overrides: { pools: [],sources: [] },contentBindings: [{ sourceIdentity: 'source',revisionId: 'revision',commit: 'a'.repeat(40),adapterVersion: 6,enabledPublications: [] }],
    instances: { features: [],spells: [],pools: [],sources: [],actions: [] },derived: null,
    session: { currentHp: 7,tempHp: 4,deathSaves: { successes: 0,failures: 0 },resources: {},annotations: { note: ['Keep'] } },
    presentation: { showNotes: true },snapshots: [],compatibility: { legacy: { unknown: 1 } },extensions: { custom: { version: 1,payload: 'keep' } },
  };
  return { document,index };
}
describe('Native documents and preview acceptance', () => {
  it('recomputes referenced subclass grants on library updates and preserves their IDs and personal state', () => {
    const f = fixture();
    const records = mapContent({ subclass: [{ name: 'Stars', shortName: 'Stars', source: 'TEST', className: 'Mage', classSource: 'TEST',
      subclassFeatures: ['Stars Gifts|Mage|TEST|Stars|TEST|3'] }],
      subclassFeature: ['Stars Gifts', 'Star Map'].map(name => ({ name, source: 'TEST', className: 'Mage', classSource: 'TEST',
        subclassShortName: 'Stars', subclassSource: 'TEST', level: 3, entries: [`${name} description.`] })),
    }, 'stars.json').records;
    records.forEach(record => f.index.records.set(record.key, record));
    f.document.creation.classes.selections[0].subclassKey = records.find(record => record.kind === 'subclass')!.key;
    const original = acceptDocumentPreview(f.document, previewDocument(f.document, f.index));
    expect(original.instances.features.map(instance => instance.snapshot.name)).toEqual(['Stars Gifts']);
    const root = records.find(record => record.name === 'Stars Gifts')!, child = records.find(record => record.name === 'Star Map')!;
    root.data['entries'] = [{ type: 'refSubclassFeature', subclassFeature: 'Star Map|Mage|TEST|Stars|TEST|3' }];
    const nextIndex = { ...f.index, revisionId: 'stars-v2' };
    const target = { ...original.contentBindings[0], revisionId: nextIndex.revisionId, commit: 'b'.repeat(40) };
    const added = acceptDocumentPreview(original, previewContentUpdate(original, nextIndex, target));
    const map = added.instances.features.find(instance => instance.contentKey === child.key)!;
    expect(map.revisionId).toBe('stars-v2'); expect(map.grants).toHaveLength(1);
    map.customization = { notes: ['Keep my note'], used: 1 };
    added.session.annotations[map.id] = ['Map annotation'];
    child.data['entries'] = ['Updated map description.'];
    const finalIndex = { ...f.index, revisionId: 'stars-v3' };
    const updated = acceptDocumentPreview(added, previewContentUpdate(added, finalIndex,
      { ...target, revisionId: finalIndex.revisionId, commit: 'c'.repeat(40) }));
    const fresh = updated.instances.features.find(instance => instance.contentKey === child.key)!;
    expect(fresh.id).toBe(map.id); expect(fresh.snapshot.data['entries']).toEqual(['Updated map description.']);
    expect(fresh.customization).toEqual(map.customization);
    expect(updated.session.annotations[map.id]).toEqual(['Map annotation']);
    expect(updated.instances.features).toHaveLength(2);
  });

  it('round-trips native documents and preserves unknown identity/extension/session state', () => {
    const f = fixture(); const parsed = parseCharacterDocument(JSON.stringify(f.document));
    expect(parsed).toEqual(f.document);
    const preview = previewDocument(parsed,f.index); expect(preview.diagnostics).toEqual([]); expect(preview.canAccept).toBe(true);
    const accepted = acceptDocumentPreview(parsed,preview);
    expect(accepted.derived?.maxHp).toBe(20); expect(accepted.instances.spells).toHaveLength(1);
    expect(accepted.instances.sources).toHaveLength(1); expect(accepted.derived?.casting[0]).toMatchObject({ dc: 13,toHit: 5 });
    expect(accepted.instances.pools.find(p => p.kind === 'feature-uses')).toMatchObject({ total: 2,regain: 'LONG_REST' });
    expect(accepted.session.annotations).toEqual(parsed.session.annotations); expect(accepted.extensions).toEqual(parsed.extensions);
    expect(parseCharacterDocument(JSON.stringify(accepted))).toEqual(accepted);
    expect(acceptDocumentPreview(accepted,previewDocument(accepted,f.index))).toEqual(accepted);
  });
  it('rejects stale/forged previews and ignores mutations of the public review copy', () => {
    const f = fixture(); const preview = previewDocument(f.document,f.index);
    preview.proposed!.session.currentHp = 999;
    expect(acceptDocumentPreview(f.document,preview).session.currentHp).toBe(7);
    const edited = structuredClone(f.document); edited.session.annotations['note'].push('Edit');
    expect(() => acceptDocumentPreview(edited,preview)).toThrow('Stale');
    expect(() => acceptDocumentPreview(f.document,{ ...preview })).toThrow('Unknown');
  });
  it('requires explicit HP/usage/removed-pool decisions and retains counters until accepted', () => {
    const f = fixture(); const first = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const slot = first.instances.pools.find(p => p.kind === 'spell-slots')!;
    first.session.resources[slot.id].used = 4; first.session.currentHp = 20; first.creation.classes.selections[0].level = 1;
    const preview = previewDocument(first,f.index);
    expect(preview.canAccept).toBe(false); expect(preview.proposed?.session.currentHp).toBe(20);
    expect(() => acceptDocumentPreview(first,preview)).toThrow('decision');
    const decisions = Object.fromEntries(preview.adjustments.map(a => [a.id,a.kind === 'removed-pool' ? 'retain' : 'clamp'])) as Record<string,'retain' | 'clamp'>;
    const accepted = acceptDocumentPreview(first,preview,decisions);
    expect(accepted.session.currentHp).toBe(8); expect(accepted.session.resources[slot.id].used).toBe(2);
    expect(first.session.resources[slot.id].used).toBe(4);
  });
  it('applies resource/source customization and rejects dangling action links', () => {
    const f = fixture(); const first = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const pool = first.instances.pools.find(p => p.kind === 'feature-uses')!; const source = first.instances.sources[0];
    first.session.resources[pool.id].used = 2; source.label = 'Renamed'; source.customization = { note: 'Keep' };
    first.overrides = { pools: [{ poolId: pool.id,total: 1,regain: 'SHORT_REST' }],sources: [{ sourceId: source.id,customDc: 0,customToHit: 7,useSpellbook: true }] };
    first.creation.actions = [{ id: 'action',label: 'Cast',text: 'Manual text',poolId: pool.id,sourceId: source.id,instanceId: first.instances.spells[0].id,customization: {} }];
    const preview = previewDocument(first,f.index);
    const accepted = acceptDocumentPreview(first,preview,Object.fromEntries(preview.adjustments.map(a => [a.id,'keep'])) as Record<string,'keep'>);
    expect(accepted.derived?.casting[0]).toMatchObject({ dc: 0,toHit: 7 });
    expect(accepted.instances.sources[0].label).toBe('Renamed'); expect(accepted.instances.actions[0].text).toBe('Manual text');
    first.creation.actions[0].instanceId = 'missing'; expect(previewDocument(first,f.index).canAccept).toBe(false);
  });
  it('performs versioned play actions without modifying original document or changing rest policy implicitly', () => {
    const f = fixture(); const first = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const damaged = performDocumentAction(first,{ type: 'damage',amount: 6 });
    expect(damaged.session.currentHp).toBe(5); expect(first.session.currentHp).toBe(7);
    const rested = performDocumentAction(damaged,{ type: 'rest',rest: 'long',policy: 'android-v1' });
    expect(rested.session.currentHp).toBe(20);
    expect(() => performDocumentAction(first,{ type: 'rest',rest: 'long',policy: 'web-viewer-v1' })).toThrow('policy');
  });
  it('rejects future versions, malformed numeric inputs, oversized/nonportable values and duplicate IDs', () => {
    const f = fixture(); expect(() => validateCharacterDocument({ ...f.document,schemaVersion: 2 })).toThrow('Unsupported');
    const invalid = structuredClone(f.document); invalid.creation.abilities.con = NaN;
    expect(() => validateCharacterDocument(invalid)).toThrow();
    expect(() => validateCharacterDocument({ ...f.document,extensions: { runtime: new Set(['value']) } })).toThrow('portable');
    const accepted = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    accepted.instances.pools.push(structuredClone(accepted.instances.pools[0])); expect(() => validateCharacterDocument(accepted)).toThrow('Duplicate');
  });
  it('restores generated feature IDs and notes from history after a level decrease/increase', () => {
    const f = fixture(); const feature = mapContent({ classFeature: [{ name: 'Gift',source: 'TEST',className: 'Mage',classSource: 'TEST',level: 3 }] },'test.json').records[0];
    f.index.records.set(feature.key,feature);
    f.index.records.get(f.document.creation.classes.selections[0].classKey)!.data['classFeatures'] = ['Gift|Mage|TEST|3'];
    const first = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    first.instances.features[0].id = 'assigned-feature'; first.instances.features[0].customization = { notes: ['Keep after return'] };
    first.creation.classes.selections[0].level = 1;
    const lowerPreview = previewDocument(first,f.index);
    const lower = acceptDocumentPreview(first,lowerPreview,Object.fromEntries(lowerPreview.adjustments.map(a => [a.id,a.kind === 'removed-pool' ? 'retain' : 'keep'])) as Record<string,'retain' | 'keep'>);
    expect(lower.instances.features).toEqual([]);
    lower.creation.classes.selections[0].level = 3;
    const restored = acceptDocumentPreview(lower,previewDocument(lower,f.index));
    expect(restored.instances.features[0].id).toBe('assigned-feature');
    expect(restored.instances.features[0].customization).toEqual({ notes: ['Keep after return'] });
  });
  it('makes scalar overrides explicit, validates active links and enforces size limits', () => {
    const f = fixture(); f.document.overrides.maxHp = 0; f.document.overrides.armorClass = 0; f.document.overrides.initiative = 0;
    const preview = previewDocument(f.document,f.index); expect(preview.adjustments[0].kind).toBe('hp');
    const accepted = acceptDocumentPreview(f.document,preview,{ hp: 'clamp' });
    expect(accepted.derived?.maxHp).toBe(0); expect(accepted.derived?.stats.ac).toBe(0); expect(accepted.session.currentHp).toBe(0);
    const invalid = structuredClone(accepted); invalid.instances.spells[0].castingSourceId = 'missing';
    expect(() => validateCharacterDocument(invalid)).toThrow('casting source');
    expect(() => parseCharacterDocument(' '.repeat(10*1024*1024+1))).toThrow('10 MiB');
  });
  it('explicitly updates selected snapshots while retaining IDs, notes, usage and source customization', () => {
    const f = fixture(); const original = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    original.instances.spells[0].customization = { notes: ['Keep'],custom: 7 };
    original.instances.sources[0].label = 'User label';
    const innate = original.instances.pools.find(p => p.kind === 'feature-uses')!; original.session.resources[innate.id].used = 1;
    const records = new Map([...f.index.records].map(([key,record]) => [key,structuredClone(record)]));
    const spell = [...records.values()].find(r => r.kind === 'spell')!; spell.data['entries'] = ['New synthetic text'];
    const index = { ...f.index,revisionId: 'new-revision',records };
    const target = { ...original.contentBindings[0],revisionId: index.revisionId,commit: 'b'.repeat(40) };
    const before = structuredClone(original); const preview = previewContentUpdate(original,index,target);
    expect(preview.diagnostics).toEqual([]); expect(preview.canAccept).toBe(true);
    expect(preview.changes).toContainEqual({ key: spell.key,kind: 'changed',fields: ['entries'] });
    const accepted = acceptDocumentPreview(original,preview);
    expect(accepted.contentBindings[0].commit).toBe(target.commit);
    expect(accepted.instances.spells[0].id).toBe(original.instances.spells[0].id);
    expect(accepted.instances.spells[0].customization).toEqual(original.instances.spells[0].customization);
    expect(accepted.instances.spells[0].snapshot.data['entries']).toEqual(['New synthetic text']);
    expect(accepted.instances.sources[0].label).toBe('User label'); expect(accepted.session.resources[innate.id].used).toBe(1);
    expect(original).toEqual(before); expect(Array.isArray(accepted.compatibility['contentUpdates'])).toBe(true);
  });
  it('blocks missing/renamed required content, changed sources and stale update acceptance', () => {
    const f = fixture(); const original = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const records = new Map(f.index.records); records.delete(original.instances.spells[0].contentKey);
    const index = { ...f.index,revisionId: 'new',records }; const target = { ...original.contentBindings[0],revisionId: 'new',commit: 'b'.repeat(40) };
    const missing = previewContentUpdate(original,index,target); expect(missing.canAccept).toBe(false);
    expect(missing.changes.some(c => c.kind === 'missing')).toBe(true);
    expect(() => acceptDocumentPreview(original,missing)).toThrow('Unknown');
    expect(previewContentUpdate(original,{ ...index,sourceIdentity: 'other' },{ ...target,sourceIdentity: 'other' }).canAccept).toBe(false);
    const valid = previewContentUpdate(original,{ ...index,records: f.index.records },target);
    original.session.annotations['note'].push('Concurrent edit');
    expect(() => acceptDocumentPreview(original,valid)).toThrow('Stale');
  });
  it('routes update-induced slot reductions through explicit adjustment decisions', () => {
    const f = fixture(); const original = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const slot = original.instances.pools.find(p => p.kind === 'spell-slots')!; original.session.resources[slot.id].used = 4;
    const records = new Map([...f.index.records].map(([key,record]) => [key,structuredClone(record)]));
    [...records.values()].find(r => r.kind === 'class')!.data['casterProgression'] = '1/2';
    const index = { ...f.index,records,revisionId: 'new' }; const target = { ...original.contentBindings[0],revisionId: 'new',commit: 'b'.repeat(40) };
    const preview = previewContentUpdate(original,index,target); expect(preview.canAccept).toBe(false); expect(preview.proposed).toBeDefined();
    expect(() => acceptDocumentPreview(original,preview)).toThrow('decision');
    const decisions = Object.fromEntries(preview.adjustments.map(a => [a.id,a.kind === 'removed-pool' ? 'retain' : 'clamp'])) as Record<string,'retain' | 'clamp'>;
    const accepted = acceptDocumentPreview(original,preview,decisions);
    expect(accepted.session.resources[slot.id].used).toBe(2); expect(original.session.resources[slot.id].used).toBe(4);
  });
  it('spends accepted innate costs without changing source labels or unrelated state', () => {
    const f = fixture(); const original = acceptDocumentPreview(f.document,previewDocument(f.document,f.index));
    const cost = original.derived!.spellResourceCosts![0];
    const once = performSpellResourceUse(original,cost.id); const twice = performSpellResourceUse(once,cost.id);
    expect(twice.session.resources[cost.poolId].used).toBe(2);
    expect(() => performSpellResourceUse(twice,cost.id)).toThrow('Insufficient');
    expect(original.session.resources[cost.poolId].used).toBe(0);
    expect(twice.session.annotations).toEqual(original.session.annotations);
    const rested = performDocumentAction(twice,{ type: 'rest',rest: 'long',policy: 'android-v1' });
    expect(rested.session.resources[cost.poolId].used).toBe(0);
  });
});
