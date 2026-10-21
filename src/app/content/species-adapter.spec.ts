import 'fake-indexeddb/auto';
import { adaptSpecies, assertSpeciesDefinition, canonicalSpeciesRecord, formatSpeciesMovement } from './species-adapter';
import { projectSpeciesEntity, speciesMovementText } from './species-compatibility';
import { ContentRecord, ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { deriveSpeciesAbilities } from '../rules/ability-rules';
import { deriveStats } from '../rules/derived-stats';
import { deriveSpecies } from '../rules/species-rules';
import { captureSheet, newCharacter, projectSheet } from '../editor/editor-document';
import { parseCharacterDocument, validateCharacterDocument } from '../rules/character-document';
import { LocalCharacterRepository } from '../editor/local-character-repository';
import { emptyBasicCharacter } from '../editor/basic-info';
import { portableCharacter } from '../characters/portable-character';
import { encodeCloudCharacter, decodeCloudCharacter, characterHash } from '../characters/sync/character-cloud';

function record(data: Record<string, unknown>): ContentRecord {
  return { kind: 'species', key: 'synthetic-species', name: 'Synthetic', publication: 'TEST', file: 'synthetic.json', links: [], data };
}
function context(value: ContentRecord) {
  return { sourceIdentity: 'library', revisionId: 'revision', records: new Map([[value.key, value]]) };
}
const scores = { str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 10 };

describe('Canonical species contract', () => {
  it('maps legal movement alternatives, references, metadata and weighted abilities without duplicating source mechanics', () => {
    const source = record({ speed: { walk: 30, fly: true, canHover: true, hidden: ['swim'],
      alternate: { walk: [{ number: 20, condition: 'while carrying a load' }], sourceNote: 'Retained extension' },
      choose: { from: ['swim', 'climb'], amount: 25 } },
      ability: [{ con: 1, hidden: true, max: 22, choose: { weighted: { from: ['str','dex'], weights: [2,1] }, entry: 'Allocate in order' } }],
      resist: ['cold', { choose: { from: ['fire','acid'] } }], creatureTypes: ['humanoid'], size: ['M'], darkvision: 60,
      entries: ['A synthetic description'], skillProficiencies: [{ perception: true }], additionalSpells: [] });
    const original = structuredClone(source);
    const result = canonicalSpeciesRecord(source);
    expect(result.species.movement).toMatchObject({ kind: 'defined', modes: { walk: { kind: 'fixed', feet: 30 }, fly: { kind: 'walk-reference' } },
      alternativeExtensions: { sourceNote: 'Retained extension' }, hover: true, hidden: ['swim'] });
    expect(result.species.abilities[0]).toMatchObject({ fixed: { con: 1 }, maximum: 22, hidden: true,
      choice: { kind: 'weighted', from: ['str','dex'], weights: [2,1], entry: 'Allocate in order' } });
    expect(result.data['speed']).toBeUndefined(); expect(result.data['ability']).toBeUndefined();
    expect(result.data['entries']).toEqual(source.data['entries']);
    expect(result.data['skillProficiencies']).toEqual(source.data['skillProficiencies']);
    expect(result.data['additionalSpells']).toEqual([]);
    expect(source).toEqual(original);
  });

  it('preserves variable and unresolved walk-based movement as explicit outcomes', () => {
    expect(adaptSpecies({ speed: 'Varies' }).movement).toEqual({ kind: 'variable' });
    const value = canonicalSpeciesRecord(record({ speed: { fly: true } }));
    expect(projectSpeciesEntity(value).speed).toEqual({});
    const preview = deriveSpecies({ id: 'selection', key: value.key }, context(value));
    expect(preview.canAccept).toBe(true);
    expect(preview.warnings).toContain('fly movement requires a usable walking speed or manual value.');
  });

  it('keeps conditional speeds visible without exporting them as unconditional values', () => {
    const value = canonicalSpeciesRecord(record({ speed: { walk: 30, fly: { number: 40, condition: 'without armor' } } }));
    const entity = projectSpeciesEntity(value);
    expect(entity.speed).toEqual({ walk: 30 });
    expect(speciesMovementText(entity)).toContain('fly 40 ft. without armor');
    expect(formatSpeciesMovement(value.species)).toContain('walk 30 ft.');
    expect(speciesMovementText({ name: 'Old', source: 'OLD', speed: { walk: 25 } })).toContain('walk 25');
  });

  it('allocates weighted bonuses in answer order, honors maxima, and never lowers an authored score above the maximum', () => {
    const value = canonicalSpeciesRecord(record({ ability: [{ choose: { weighted: { from: ['str','dex','con'], weights: [2,1] } }, max: 20 }] }));
    const selected = { id: 'selection', key: value.key };
    const result = deriveSpeciesAbilities(scores, context(value), selected, true, { chosen: ['dex','con'] });
    expect(result.canAccept).toBe(true); expect(result.effective.dex).toBe(16); expect(result.effective.con).toBe(15);
    expect(result.choices[0].weights).toEqual([2,1]);
    expect(deriveSpeciesAbilities(scores, context(value), selected, true, { chosen: ['dex','dex'] }).canAccept).toBe(false);
    const capped = deriveSpeciesAbilities({ ...scores, dex: 19 }, context(value), selected, true, { chosen: ['dex','con'] });
    expect(capped.effective.dex).toBe(20); expect(capped.contributions.find(c => c.ability === 'dex')?.amount).toBe(1);
    expect(deriveSpeciesAbilities({ ...scores, dex: 22 }, context(value), selected, true, { chosen: ['dex','con'] }).effective.dex).toBe(22);
    expect(deriveSpeciesAbilities(scores, context(value), selected, false).effective).toEqual(scores);
  });

  it('retains under-specified schema-valid definitions while refusing to invent their mechanics', () => {
    const definition = adaptSpecies({ ability: [{ choose: { weighted: {} } }], resist: [{}] });
    expect(definition.abilities[0].choice).toMatchObject({ kind: 'unavailable', source: { weighted: {} } });
    expect(definition.defenses.resist[0]).toMatchObject({ kind: 'unavailable', source: {} });
    const nested = canonicalSpeciesRecord(record({ resist: [{ choose: { from: [{ choose: { from: ['cold','fire'] } }] } }] }));
    expect(deriveSpecies({ id: 'selection', key: nested.key }, context(nested)).diagnostics).toContain('Nested species resistance choices require a handler.');
  });

  it('collects explicit movement, immunity, creature-type and size selections', () => {
    const value = canonicalSpeciesRecord(record({ speed: { walk: 30, choose: { from: ['fly','swim'], amount: 20 } },
      immune: [{ choose: { from: ['cold','fire'] } }], creatureTypes: [{ choose: ['humanoid','fey'] }], size: ['S','M'] }));
    const selected = { id: 'selection', key: value.key };
    const pending = deriveSpecies(selected, context(value));
    expect(pending.canAccept).toBe(false); expect(pending.choices).toHaveLength(4);
    const answers = Object.fromEntries(pending.choices.map(choice => [choice.id, [choice.candidates[0]]]));
    const accepted = deriveSpecies(selected, context(value), [], undefined, answers);
    expect(accepted.canAccept).toBe(true);
    expect(accepted.generated).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'immune', value: 'cold' }), expect.objectContaining({ field: 'size', value: 'S' })]));
  });

  it('rejects malformed historical conditions and explicit null ability defaults', () => {
    expect(() => adaptSpecies({ speed: { walk: { number: 30, condition: 123 } } }, 'legacy')).toThrow();
    expect(() => adaptSpecies({ ability: [{ max: null }] })).toThrow();
    expect(() => adaptSpecies({ ability: [{ choose: { from: ['str'], count: null } }] })).toThrow();
    expect(adaptSpecies({ ability: [{ choose: { from: ['str'] } }] }).abilities[0]).toMatchObject({ maximum: 20, choice: { count: 1, amount: 1 } });
  });

  it('rejects corrupted contracts, unknown versions and conflicting duplicate mechanics', () => {
    const value = canonicalSpeciesRecord(record({ speed: 30 }));
    expect(() => assertSpeciesDefinition({ ...value.species, version: 2 })).toThrow('Invalid canonical species');
    expect(() => assertSpeciesDefinition({ ...value.species, movement: { kind: 'defined', modes: { walk: { kind: 'fixed', feet: '30' } }, alternatives: {}, hover: false, hidden: [] } })).toThrow();
    expect(() => canonicalSpeciesRecord({ ...value, data: { speed: 99 } })).toThrow('duplicate legacy');
  });
});

describe('Offline species snapshots', () => {
  function fixture() {
    const revision: ImportRevision = { id: 'revision', namespace: 'species-migration', source: DEFAULT_CONTENT_SOURCE,
      sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
      createdAt: new Date().toISOString(), status: 'ready', files: [], diagnostics: [], metrics: { bytes: 0, records: 1, elapsedMs: 0, mappedBytes: 0 } };
    const document = newCharacter(revision);
    document.creation.classes.selections = [{ selectionId: 'class-selection', classKey: 'synthetic-class', level: 1 }];
    const snapshot = record({ speed: { walk: { number: 30 }, fly: { number: 40, condition: 'without armor' } },
      resist: [{ type: 'cold' }], ability: [{ con: 2 }], entries: ['Offline trait'] });
    document.instances.species = { id: 'stable-instance', selectionId: 'stable-selection', contentKey: snapshot.key,
      sourceIdentity: revision.sourceIdentity, revisionId: revision.id, snapshot, customization: { retained: 'authored value' } };
    document.snapshots = [snapshot, { key: 'synthetic-class', kind: 'class', name: 'Synthetic Class', publication: 'TEST',
      file: 'synthetic.json', links: [], data: { name: 'Synthetic Class', source: 'TEST', classFeatures: [], hd: { number: 1, faces: 6 } } }];
    document.session = { ...document.session, currentHp: 7, tempHp: 3, resources: { orphan: { used: 2 } }, annotations: { 'stable-instance': ['Retained note'] } };
    const sheet = emptyBasicCharacter();
    sheet.species = { name: snapshot.name, source: snapshot.publication, notes: [{ tag: 'Notes', notes: ['Keep me'] }],
      uses: [{ tag: 'Uses', totalFreeUses: 3, usedFreeUses: 2, freeUsesRegainCondition: 'LONG_REST' }] };
    document.presentation['sheet'] = sheet;
    return document;
  }

  it('migrates native legacy snapshots without changing IDs, provenance, notes or resource state', () => {
    const original = fixture(); const before = structuredClone(original);
    const migrated = parseCharacterDocument(JSON.stringify(original));
    expect(migrated.instances.species?.id).toBe('stable-instance');
    expect(migrated.instances.species?.snapshot.species?.version).toBe(1);
    expect(migrated.instances.species?.snapshot.data['speed']).toBeUndefined();
    expect(migrated.session).toEqual(original.session);
    expect(migrated.contentBindings).toEqual(original.contentBindings);
    expect(migrated.instances.species?.customization).toEqual({ retained: 'authored value' });
    expect(original).toEqual(before);
    expect(validateCharacterDocument(migrated)).toEqual(migrated);
    const projected = projectSheet(migrated);
    expect(projected.species?.entity?.definition?.version).toBe(1);
    expect(projected.species?.entity?.speed).toEqual({ walk: 30 });
    expect(projected.species?.notes?.[0].notes).toEqual(['Keep me']);
    expect(projected.species?.uses?.[0].usedFreeUses).toBe(2);
  });

  it('exports manual scores even when a saved document contains old automated scores', () => {
    const document = validateCharacterDocument(fixture());
    document.creation.abilities = { ...scores };
    document.creation.applySpeciesAbilities = true;
    document.derived = { maxHp: 8, stats: deriveStats({ abilities: scores, totalLevel: 1, armor: [], calculateAc: true, manualAc: 10, manual: [], generated: [] }),
      speciesContributions: [], casting: [], effectiveAbilities: { ...scores, con: 16 },
      abilityContributions: [{ ability: 'con', amount: 2, origin: 'historical-species-bonus' }] };
    expect(projectSheet(document).character?.abilityScores?.constitution).toBe(14);
    expect(document.derived.effectiveAbilities?.con).toBe(16);
  });

  it('saves, reloads and projects self-contained species without consulting the content library', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      const document = fixture(); const repository = new LocalCharacterRepository();
      await repository.save(document, 0);
      const reopened = (await new LocalCharacterRepository().list()).find(entry => entry.id === document.id)!;
      const sheet = portableCharacter(projectSheet(reopened.document));
      const encoded = await encodeCloudCharacter({ id: sheet.character!.characterUuid!, sheet, version: 1, updatedAt: new Date().toISOString() }, 1);
      const decoded = await decodeCloudCharacter(sheet.character!.characterUuid!, encoded);
      expect(decoded.sheet.species).toEqual(sheet.species);
      expect(decoded.sheet.species?.entity?.entries).toEqual(['Offline trait']);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });

  it('retains structured speed conditions and play overrides across native capture and reload', () => {
    const document = validateCharacterDocument(fixture());
    const projected = projectSheet(document);
    const fly = projected.character!.speeds!.find(speed => speed.type === 'fly')!;
    expect(fly.condition).toBe('without armor');
    fly.overrideFeet = 15;
    const reloaded = parseCharacterDocument(JSON.stringify(captureSheet(document, projected)));
    expect(projectSheet(reloaded).character?.speeds?.find(speed => speed.id === fly.id)).toMatchObject({ overrideFeet: 15, condition: 'without armor' });
    const reset = projectSheet(reloaded);
    delete reset.character!.speeds!.find(speed => speed.id === fly.id)!.overrideFeet;
    const restored = projectSheet(captureSheet(reloaded, reset)).character!.speeds!.find(speed => speed.id === fly.id)!;
    expect(restored.overrideFeet).toBeUndefined();
    expect(restored.value).toEqual({ kind: 'fixed', feet: 40 });
  });

  it('rejects an invalid canonical extension even when cloud transport integrity is valid', async () => {
    const sheet = projectSheet(validateCharacterDocument(fixture()));
    const invalid = JSON.parse(JSON.stringify(sheet)); invalid.species.entity.definition.version = 99;
    expect(() => portableCharacter(invalid)).toThrow('Invalid canonical species');
    const body = JSON.stringify(invalid);
    await expect(decodeCloudCharacter(sheet.character!.characterUuid!, { body, meta: { revision: 1,
      hash: await characterHash(body, false), deleted: false, updatedAt: new Date().toISOString() } })).rejects.toThrow('Invalid canonical species');
  });
});
