import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapContent } from '../content/content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { WizardState } from './wizard-prefill';
import { matchesSubclass, previewClassWizard } from './class-wizard-preview';
import { ClassWizardComponent } from './class-wizard.component';

function fixture() {
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'class-wizard-test' };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
    sourceIdentity: sourceIdentity(source), commit: 'd'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'ready',
    createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 12, elapsedMs: 0, mappedBytes: 0 } };
  const records = mapContent({
    class: [
      { name: 'Mage', source: 'TEST', hd: { number: 1, faces: 6 }, casterProgression: 'full', spellcastingAbility: 'int',
        proficiency: ['int', 'wis'], startingProficiencies: { weapons: ['simple'], skills: [{ choose: { from: ['arcana', 'history'], count: 1 } }] },
        classFeatures: ['Gift|Mage|TEST|1', 'Greater Gift|Mage|TEST|3'] },
      { name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 }, proficiency: ['str', 'con'],
        multiclassing: { proficienciesGained: { weapons: ['martial'], armor: ['light'] } }, classFeatures: ['Training|Fighter|TEST|1'] },
      { name: 'Pact', source: 'TEST', hd: { number: 1, faces: 8 }, casterProgression: 'pact', spellcastingAbility: 'cha', classFeatures: [] },
    ],
    subclass: [{ name: 'School', shortName: 'School', source: 'TEST', className: 'Mage', classSource: 'TEST',
      subclassFeatures: ['School Gift|Mage|TEST|School|TEST|3'], additionalSpells: [{ ability: 'int', innate: { '3': { daily: { '1': ['Shield|TEST'] } } } }] }],
    classFeature: [
      { name: 'Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 1, entries: ['Gift description'] },
      { name: 'Greater Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 3 },
      { name: 'Training', source: 'TEST', className: 'Fighter', classSource: 'TEST', level: 1 },
    ],
    subclassFeature: [{ name: 'School Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassShortName: 'School', subclassSource: 'TEST', level: 3 }],
    spell: ['Shield', 'Spark'].map((name, position) => ({ name, source: 'TEST', level: position === 0 ? 1 : 0, school: 'A', entries: ['Spell description'], classes: { fromClassList: [{ name: 'Mage', source: 'TEST' }] } })),
    race: [{ name: 'Elf', source: 'TEST', speed: 25, darkvision: 60, languageProficiencies: [{ elvish: true }], entries: ['Species description'] }],
  }, 'wizard-fixture.json').records;
  // Materialized species are what the importer provides to the creator.
  records.push({ key: 'species-test', kind: 'species', name: 'Elf', publication: 'TEST', file: 'species.json', links: [],
    data: { name: 'Elf', source: 'TEST', speed: { walk: { number: 25 } }, darkvision: 60, languageProficiencies: [{ elvish: true }], entries: ['Species description'] } });
  const find = (kind: string, name: string) => records.find(record => record.kind === kind && record.name === name)!;
  const state: WizardState = { revisionId: revision.id, classes: [
    { selectionId: 'mage', classKey: find('class', 'Mage').key, subclassKey: find('subclass', 'School').key, level: 3, spellList: 'Mage', useSpellbook: true },
    { selectionId: 'fighter', classKey: find('class', 'Fighter').key, level: 1 },
  ], answers: {}, options: {}, baseline: [], protectedPaths: [] };
  const index = new Map(records.map(record => [record.key, record]));
  const sheet = emptyBasicCharacter(); sheet.character!.abilityScores!.constitution = 14;
  return { revision, records, find, state, index, sheet };
}

describe('Subclass-granted spell prefill', () => {
  it('imports prepared spells and ability-based innate uses together, with a minimum of one', () => {
    const f = fixture();
    f.find('subclass', 'School').data['additionalSpells'] = [{
      prepared: { '3': ['Spark|TEST'] },
      innate: { '9': { daily: { int: ['Shield|TEST'] } } },
    }];
    f.state.classes[0].level = 9;
    for (const [score, expected] of [[18, 4], [10, 1], [8, 1]]) {
      f.sheet.character!.abilityScores!.intelligence = score;
      const result = previewClassWizard(f.sheet, f.state, f.revision, f.index);
      expect(result.warnings).toEqual([]);
      expect(result.sheet.spells!.some(spell => spell.name === 'Spark')).toBe(true);
      expect(result.sheet.spells!.find(spell => spell.name === 'Shield' && spell.uses?.length)?.uses![0])
        .toMatchObject({ totalFreeUses: expected, freeUsesRegainCondition: 'LONG_REST' });
    }
    f.state.classes[0].level = 8;
    expect(previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet.spells!.some(spell => spell.name === 'Shield' && spell.uses?.length)).toBe(false);
  });
  it('offers selected-background proficiency choices without granting its feats, abilities, equipment or spells', () => {
    const f = fixture(); f.state.classes = [];
    const record = mapContent({ background: [{ name: 'Sage', source: 'TEST', entries: ['Reference'],
      skillProficiencies: [{ arcana: true, choose: { from: ['history', 'religion'], count: 1 } }],
      languageProficiencies: [{ elvish: true }], feats: [{ 'alert|phb': true }], ability: [{ int: 2 }], additionalSpells: [{ known: { '1': ['Shield|TEST'] } }],
    }] }, 'backgrounds.json').records[0];
    f.sheet.background = { name: record.name, source: record.publication, entity: record.data, contentReference: {
      key: record.key, sourceIdentity: f.revision.sourceIdentity, revisionId: f.revision.id, commit: f.revision.commit,
    } };
    expect(previewClassWizard(f.sheet, f.state, f.revision, f.index).choices.some(choice => choice.ownerKey === record.key)).toBe(false);
    f.index.set(record.key, record); f.state.backgroundKey = record.key;
    const first = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    const choice = first.choices.find(choice => choice.ownerKey === record.key)!;
    expect(choice.label).toBe('Sage: skill proficiencies');
    f.state.answers[choice.id] = ['history'];
    const result = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    expect(result.sheet.character!.proficiencies!.skills).toMatchObject({ ARCANA: 'PROFICIENT', HISTORY: 'PROFICIENT' });
    expect(result.sheet.character!.proficiencies!.languages).toContain('Elvish');
    expect(result.sheet.background).toEqual(f.sheet.background);
    expect(result.sheet.features ?? []).toHaveLength(0); expect(result.sheet.spells ?? []).toHaveLength(0);
    expect(result.sheet.character!.abilityScores).toEqual(f.sheet.character!.abilityScores);
    expect(result.sheet.inventory ?? []).toHaveLength(0);
  });
  it('replaces display selections while preserving custom class text, without taking editor rows as wizard inputs', () => {
    const f = fixture();
    f.sheet.classes = [{ name: 'Storyteller', subclass: 'Lorekeeper', level: 2, custom: true },
      { name: 'Display-only class', level: 8, classKey: 'display-only' }];
    f.sheet.background = { name: 'Editor background' };
    const before = structuredClone(f.sheet);
    const first = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    expect(first.sheet.background).toBeUndefined();
    expect(first.sheet.classes!.map(entry => entry.name)).toEqual(['Storyteller', 'Mage', 'Fighter']);
    expect(first.sheet.classes![0]).toEqual(before.classes![0]);
    expect(first.sheet.character!.level).toBe(6);
    expect(f.sheet).toEqual(before);
    expect(first.changes.some(change => change.path[0] === 'background' && change.action === 'Remove')).toBe(true);
    f.state.customBackgroundName = 'Wizard custom background';
    expect(previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet.background).toEqual({ name: 'Wizard custom background' });
    expect(f.state.classes.map(entry => entry.classKey)).not.toContain('display-only');
  });
  it('labels multiclass Bard choices and completes its structured skill and instrument grants', () => {
    const f = fixture();
    const extra = mapContent({
      class: [{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 }, classFeatures: [] },
        { name: 'Bard', source: 'XPHB', hd: { number: 1, faces: 8 }, classFeatures: [],
          multiclassing: { proficienciesGained: { skills: [{ choose: { from: ['arcana', 'perception'], count: 1 } }],
            tools: ['Choose one {@item Musical Instrument|XPHB}'], toolProficiencies: [{ anyMusicalInstrument: 1 }] } } }],
      item: [{ name: 'Lute', source: 'XPHB', type: 'INS|XPHB' }, { name: 'Flute', source: 'XPHB', type: 'INS|XPHB' },
        { name: 'Dice Set', source: 'XPHB', type: 'GS|XPHB' },
        { name: 'Lute', source: 'PHB', type: 'INS' }],
    }, 'bard-fixture.json').records;
    const records = new Map(extra.map(record => [record.key, record]));
    const state: WizardState = { revisionId: f.revision.id, classes: ['Fighter', 'Bard'].map(name => ({
      selectionId: name, level: 1, classKey: extra.find(record => record.kind === 'class' && record.name === name)!.key,
    })), answers: {}, options: {}, baseline: [], protectedPaths: [] };
    const initial = previewClassWizard(emptyBasicCharacter(), state, f.revision, records, ['XPHB']);
    const skill = initial.choices.find(choice => choice.label === 'Bard: skill proficiencies')!;
    const tool = initial.choices.find(choice => choice.label === 'Bard: tool proficiencies')!;
    expect(skill.searchable).toBe(false); expect(tool.searchable).toBe(false);
    expect(tool.candidates.map(candidate => candidate.label).sort()).toEqual(['Flute (XPHB)', 'Lute (XPHB)']);
    expect(previewClassWizard(emptyBasicCharacter(), state, f.revision, records).choices
      .find(choice => choice.id === tool.id)!.candidates).toHaveLength(3);
    const excluded = previewClassWizard(emptyBasicCharacter(), state, f.revision, records, ['OTHER']);
    expect(excluded.unresolved.some(choice => choice.id === tool.id && !choice.candidates.length)).toBe(true);
    state.answers[skill.id] = ['perception'];
    state.answers[tool.id] = [tool.candidates.find(candidate => candidate.label === 'Lute (XPHB)')!.value];
    const filteredAnswer = previewClassWizard(emptyBasicCharacter(), state, f.revision, records, ['PHB']);
    expect(filteredAnswer.unresolved.some(choice => choice.id === tool.id)).toBe(true);
    expect(filteredAnswer.sheet.character!.proficiencies!.tools?.['Lute (XPHB)']).toBeUndefined();
    const completed = previewClassWizard(emptyBasicCharacter(), state, f.revision, records);
    expect(completed.unresolved).toEqual([]); expect(completed.warnings).toEqual([]);
    expect(completed.sheet.character!.proficiencies!.skills!['PERCEPTION']).toBe('PROFICIENT');
    expect(completed.sheet.character!.proficiencies!.tools!['Lute (XPHB)']).toBeTruthy();
    state.answers[skill.id] = ['arcana'];
    expect(previewClassWizard(emptyBasicCharacter(), state, f.revision, records).unresolved).toEqual([]);
  });
  it('readies Arcane Trickster Mage Hand while expanded Wizard spells stay Known only', () => {
    const f = fixture();
    const extra = mapContent({
      class: [{ name: 'Rogue', source: 'XPHB', hd: { number: 1, faces: 8 }, classFeatures: [] }],
      subclass: [{ name: 'Arcane Trickster', shortName: 'Arcane Trickster', source: 'XPHB', className: 'Rogue', classSource: 'XPHB',
        casterProgression: '1/3', spellcastingAbility: 'int', subclassFeatures: [], additionalSpells: [{
          known: { '3': ['mage hand|xphb#c'] }, expanded: { '3': [{ all: 'level=0|class=Wizard' }, { all: 'level=1|class=Wizard' }] },
        }] }],
      spell: [{ name: 'Mage Hand', source: 'XPHB', level: 0 }, { name: 'Light', source: 'XPHB', level: 0 },
        { name: 'Shield', source: 'XPHB', level: 1 }].map(spell => ({ ...spell, classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }] } })),
    }, 'rogue-fixture.json').records;
    const records = new Map(extra.map(record => [record.key, record]));
    const state: WizardState = { revisionId: f.revision.id, classes: [{ selectionId: 'rogue', level: 3,
      classKey: extra.find(record => record.kind === 'class')!.key, subclassKey: extra.find(record => record.kind === 'subclass')!.key }],
      answers: {}, options: {}, baseline: [], protectedPaths: [] };
    const result = previewClassWizard(emptyBasicCharacter(), state, f.revision, records);
    expect(result.errors).toEqual([]);
    expect(result.sheet.spells!.filter(spell => spell.name === 'Mage Hand').map(spell => spell.listType).sort()).toEqual(['KNOWN', 'PREPARED']);
    expect(result.sheet.spells!.find(spell => spell.name === 'Mage Hand' && spell.listType === 'PREPARED')!.castingSourceName).toBe('Arcane Trickster (XPHB)');
    expect(result.sheet.spells!.filter(spell => spell.name !== 'Mage Hand').every(spell => spell.listType === 'KNOWN')).toBe(true);
    state.classes[0].level = 2;
    expect(previewClassWizard(emptyBasicCharacter(), state, f.revision, records).sheet.spells ?? []).toEqual([]);
  });
});

describe('Optional class wizard prefill', () => {
  beforeEach(() => { localStorage.removeItem('ally-creator-source-books'); TestBed.configureTestingModule({ providers: [provideRouter([])] }); });

  it('reads Arcana Domain’s structured rule for exactly two Wizard cantrips', () => {
    const f = fixture();
    // This additionalSpells shape is taken from class-cleric.json (Arcana Domain, SCAG).
    const records = mapContent({
      class: [{ name: 'Cleric', source: 'PHB', hd: { number: 1, faces: 8 },
        casterProgression: 'full', spellcastingAbility: 'wis', classFeatures: [] }],
      subclass: [{ name: 'Arcana Domain', shortName: 'Arcana', source: 'SCAG',
        className: 'Cleric', classSource: 'PHB', subclassFeatures: [],
        additionalSpells: [{ known: { '1': { '_': [{ choose: 'level=0|class=Wizard', count: 2 }] } } }] }],
      spell: [
        { name: 'Light', source: 'PHB', level: 0, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
        { name: 'Mage Hand', source: 'PHB', level: 0, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
        { name: 'Fire Bolt', source: 'PHB', level: 0, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
        { name: 'Shield', source: 'PHB', level: 1, classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] } },
        { name: 'Guidance', source: 'PHB', level: 0, classes: { fromClassList: [{ name: 'Cleric', source: 'PHB' }] } },
      ],
    }, 'arcana-domain.json').records;
    const index = new Map(records.map(record => [record.key, record]));
    f.state.classes = [{ selectionId: 'cleric', level: 1,
      classKey: records.find(record => record.kind === 'class')!.key,
      subclassKey: records.find(record => record.kind === 'subclass')!.key }];
    const first = previewClassWizard(f.sheet, f.state, f.revision, index);
    expect(first.errors).toEqual([]); expect(first.warnings).toEqual([]);
    const choice = first.choices.find(choice => choice.label === 'Arcana Domain: spells')!;
    expect(choice.count).toBe(2);
    expect(choice.candidates.map(candidate => index.get(candidate.value)!.name).sort()).toEqual(['Fire Bolt', 'Light', 'Mage Hand']);
    f.state.answers[choice.id] = [choice.candidates[0].value];
    expect(previewClassWizard(f.sheet, f.state, f.revision, index).unresolved).toHaveLength(1);
    f.state.answers[choice.id] = [choice.candidates[0].value, choice.candidates[0].value];
    expect(previewClassWizard(f.sheet, f.state, f.revision, index).unresolved).toHaveLength(1);
    f.state.answers[choice.id] = choice.candidates.slice(0, 2).map(candidate => candidate.value);
    const result = previewClassWizard(f.sheet, f.state, f.revision, index);
    expect(result.unresolved).toEqual([]);
    expect(result.sheet.spells!.filter(spell => spell.listType === 'KNOWN')).toHaveLength(2);
    expect(result.sheet.spells!.filter(spell => spell.listType === 'PREPARED')).toHaveLength(2);
    expect(result.sheet.spells!.every(spell => ['KNOWN', 'PREPARED'].includes(spell.listType!) && spell.castingSourceName === 'Arcana Domain (SCAG)')).toBe(true);
    expect(result.sheet.character!.featureSources!.find(source => source.name === 'Arcana Domain (SCAG)')!.usesWisdom).toBe(true);
  });

  it('prefills ordered multiclass HP, proficiencies, sources, features, known spells and daily casting', async () => {
    const f = fixture();
    const initial = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    expect(initial.errors).toEqual([]); expect(initial.unresolved).toHaveLength(1);
    const skill = initial.choices.find(choice => choice.label.endsWith(': skill proficiencies'))!;
    f.state.answers[skill.id] = ['arcana'];
    const result = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    expect(result.errors).toEqual([]); expect(result.warnings).toEqual([]); expect(result.unresolved).toEqual([]);
    expect(result.sheet.character!.level).toBe(4); expect(result.sheet.character!.maxHp).toBe(28);
    expect(result.sheet.character!.hitDice).toEqual([{ dieType: 'd6', total: 3, used: 0, userAdded: false }, { dieType: 'd10', total: 1, used: 0, userAdded: false }]);
    expect(result.sheet.character!.proficiencies!.savingThrows).toEqual(['INT', 'WIS']);
    expect(result.sheet.character!.proficiencies!.skills!['ARCANA']).toBe('PROFICIENT');
    expect(result.sheet.character!.proficiencies!.martialWeapons).toBe(true);
    expect(result.sheet.features).toHaveLength(4);
    expect(result.sheet.character!.spellSlots!['Mage (TEST)'].map(slot => slot.total)).toEqual([4, 2]);
    expect(result.sheet.spells!.some(spell => spell.name === 'Spark' && spell.listType === 'KNOWN')).toBe(true);
    expect(result.sheet.spells!.find(spell => spell.listType === 'PREPARED')!.uses![0].freeUsesRegainCondition).toBe('LONG_REST');
    expect(f.sheet.features).toBeUndefined(); validateBasicInfo(result.sheet);
    const repository = new IndexedDbCharacterRepository(); await repository.save(result.sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === result.sheet.character!.characterUuid)!.sheet;
    expect(saved.creatorWizard!.classes).toEqual(f.state.classes);
    expect(saved.features![0].contentReference!.commit).toBe(f.revision.commit);
  });

  it('repeats without duplication and preserves manual HP, deletions, source names, notes and used counters', () => {
    const f = fixture(); const first = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    const repeated = previewClassWizard(first, first.creatorWizard!, f.revision, f.index);
    expect(repeated.changes).toEqual([]); expect(repeated.sheet.features).toHaveLength(4);
    first.character!.maxHp = 123;
    first.character!.featureSources![0].customDc = 19;
    first.features![0].notes = [{ tag: 'Tactics', notes: ['Keep me'], isEditable: false }];
    const removedId = first.features![1].editorId; first.features!.splice(1, 1);
    (first.character!.hitDice as { used: number }[])[0].used = 2;
    first.character!.spellSlots!['Mage (TEST)'][0].used = 2;
    const nextState = structuredClone(first.creatorWizard!); nextState.classes[0].level = 4;
    const next = previewClassWizard(first, nextState, f.revision, f.index).sheet;
    expect(next.character!.maxHp).toBe(123); expect(next.character!.level).toBe(5);
    expect(next.character!.featureSources![0].customDc).toBe(19);
    expect(next.features!.find(feature => feature.editorId === removedId)).toBeUndefined();
    expect(next.features![0].notes![0]).toEqual({ tag: 'Tactics', notes: ['Keep me'], isEditable: false });
    expect((next.character!.hitDice as { total: number; used: number }[])[0]).toMatchObject({ total: 4, used: 2 });
    expect(next.character!.spellSlots!['Mage (TEST)'][0].used).toBe(2);
  });

  it('removes obsolete automatic entries but retains annotated features and their source', () => {
    const f = fixture(); const first = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    const subclassFeature = first.features!.find(feature => feature.name === 'School Gift')!;
    subclassFeature.notes = [{ tag: 'Keep', notes: ['My note'] }];
    const state = structuredClone(first.creatorWizard!); state.classes[0].subclassKey = undefined; state.classes[0].level = 1;
    const next = previewClassWizard(first, state, f.revision, f.index).sheet;
    expect(next.features!.some(feature => feature.name === 'Greater Gift')).toBe(false);
    expect(next.features!.some(feature => feature.name === 'School Gift')).toBe(true);
    expect(next.character!.featureSources!.some(source => source.name === subclassFeature.featureSourceName)).toBe(true);
  });

  it('does not make noncasting subclasses into spellcasting sources', () => {
    const f = fixture();
    const subclass = f.find('subclass', 'School');
    subclass.data = { ...subclass.data, className: 'Fighter', additionalSpells: [] };
    f.state.classes = [{ selectionId: 'fighter', classKey: f.find('class', 'Fighter').key, subclassKey: subclass.key, level: 3 }];
    // Re-key to match the Fighter subclass reference used by validation.
    f.index.delete(subclass.key);
    subclass.key = JSON.stringify(['subclass', 'School', 'TEST', 'Fighter', 'TEST']);
    f.index.set(subclass.key, subclass); f.state.classes[0].subclassKey = subclass.key;
    const result = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(result.character!.featureSources!.every(source => !source.isSpellcastingSource)).toBe(true);
  });

  it('recognizes explicit casting abilities but ignores empty spell definitions', () => {
    const f = fixture(); const fighter = f.find('class', 'Fighter');
    fighter.data['spellcastingAbility'] = 'int';
    fighter.data['additionalSpells'] = [{ ability: 'int' }];
    f.state.classes = [{ selectionId: 'fighter', classKey: fighter.key, level: 3 }];
    f.state.speciesKey = 'species-test';
    f.index.get('species-test')!.data['additionalSpells'] = [];
    const result = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(result.character!.featureSources!.map(source => [source.name, source.isSpellcastingSource]))
      .toEqual([['Fighter (TEST)', true]]);
    f.index.get('species-test')!.data['spellcastingAbility'] = 'wis';
    const speciesCasting = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(speciesCasting.character!.featureSources!.find(source => source.name === 'Elf (TEST)'))
      .toMatchObject({ isGeneralFeatureSource: false, isSpellcastingSource: true, usesWisdom: true });
    expect(result.species!.name).toBe('Elf');
  });

  it('handles species prefill and keeps existing manual fields without imposing class limits on ordinary editing', () => {
    const f = fixture(); f.state.speciesKey = 'species-test';
    f.sheet.character!.level = 25; f.sheet.character!.maxHp = 55;
    f.sheet.character!.proficiencies = { languages: ['Common'], skills: { ARCANA: 'EXPERTISE' } };
    const result = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(result.character!.level).toBe(4); expect(result.character!.maxHp).toBe(55);
    expect(result.character!.speeds!.walk).toBe(25); expect(result.character!.senses!['Darkvision']).toBe(60);
    expect(result.character!.proficiencies!.languages).toEqual(['Common', 'Elvish']);
    expect(result.character!.proficiencies!.skills!['ARCANA']).toBe('EXPERTISE');
    expect(result.species!.name).toBe('Elf'); validateBasicInfo(result);
    expect(result.character!.featureSources!.some(source => source.name === 'Elf (TEST)')).toBe(false);
    result.character!.speeds!.walk = 50;
    expect(previewClassWizard(result, result.creatorWizard!, f.revision, f.index).sheet.character!.speeds!.walk).toBe(50);
  });

  it('offers species resistance choices and replaces generated selections while keeping manual resistances', () => {
    const f = fixture(); f.state.speciesKey = 'species-test';
    f.index.get('species-test')!.data['resist'] = [{ choose: { from: ['acid', 'lightning', 'fire', 'poison', 'cold'] } }];
    f.sheet.character!.resistances = ['Thunder'];
    const initial = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    const choice = initial.choices.find(choice => choice.label === 'Elf: resistance')!;
    expect(choice.count).toBe(1); expect(choice.searchable).toBe(false);
    expect(choice.candidates.map(candidate => candidate.label)).toEqual(['Acid', 'Lightning', 'Fire', 'Poison', 'Cold']);
    expect(initial.unresolved).toContain(choice);
    expect(initial.sheet.character!.resistances).toEqual(['Thunder']);
    f.state.answers[choice.id] = ['fire'];
    const selected = previewClassWizard(f.sheet, f.state, f.revision, f.index);
    expect(selected.sheet.character!.resistances).toEqual(['Thunder', 'Fire']);
    expect(selected.sheet.species!.notes![0]).toMatchObject({ tag: 'Choices', notes: ['Resistance: Fire'], isEditable: false });
    const nextState = structuredClone(selected.sheet.creatorWizard!);
    nextState.answers[choice.id] = ['cold'];
    const changed = previewClassWizard(selected.sheet, nextState, f.revision, f.index);
    expect(changed.sheet.character!.resistances).toEqual(['Thunder', 'Cold']);
    expect(changed.sheet.species!.notes).toHaveLength(1);
    expect(changed.sheet.species!.notes![0].notes).toEqual(['Resistance: Cold']);
    nextState.answers[choice.id] = ['invalid'];
    expect(previewClassWizard(f.sheet, nextState, f.revision, f.index).unresolved.some(entry => entry.id === choice.id)).toBe(true);
  });

  it('fills the chosen species casting ability into its source and preserves species annotations', () => {
    const f = fixture(); const species = f.index.get('species-test')!;
    species.data['additionalSpells'] = [{ ability: { choose: ['int', 'wis', 'cha'] }, innate: { '1': ['Spark|TEST'] } }];
    f.state.speciesKey = species.key;
    f.state.answers[`ability:wizard-species:${species.key}`] = ['wis'];
    const first = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(first.character!.featureSources!.find(source => source.name === 'Elf (TEST)')).toMatchObject({ isGeneralFeatureSource: false, isSpellcastingSource: true, usesWisdom: true });
    first.species!.notes = [{ tag: 'Traits', notes: ['Keep the trait note'], isEditable: false }];
    first.species!.uses = [{ tag: 'Trait', totalFreeUses: 2, usedFreeUses: 1, freeUsesRegainCondition: 'SHORT_REST_ONE' }];
    const next = previewClassWizard(first, first.creatorWizard!, f.revision, f.index).sheet;
    expect(next.species!.notes).toContainEqual(first.species!.notes[0]);
    expect(next.species!.notes!.find(group => group.tag === 'Choices')!.notes).toEqual(['Casting ability: Wisdom']);
    expect(next.species!.uses).toEqual(first.species!.uses);
    const state = structuredClone(next.creatorWizard!); state.speciesKey = undefined;
    const removed = previewClassWizard(next, state, f.revision, f.index).sheet;
    expect(removed.species!.notes![0].notes).toEqual(['Keep the trait note']);
    expect(removed.character!.speeds!.walk).toBe(30); validateBasicInfo(removed);
  });

  it('rejects mismatched subclasses and calculates pact and pooled multiclass slots', () => {
    const f = fixture(); const subclass = f.find('subclass', 'School');
    expect(matchesSubclass(subclass, f.find('class', 'Fighter').key)).toBe(false);
    f.state.classes[1].subclassKey = subclass.key;
    expect(previewClassWizard(f.sheet, f.state, f.revision, f.index).errors.length).toBeGreaterThan(0);
    f.state.classes[1] = { selectionId: 'pact', classKey: f.find('class', 'Pact').key, level: 3 };
    const pact = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(pact.character!.spellSlots!['Pact (TEST)'][0]).toMatchObject({ level: 2, total: 2, regainCondition: 'SHORT_REST' });
    const secondMage = { ...f.find('class', 'Mage'), key: 'second-mage', name: 'Second Mage',
      data: { ...f.find('class', 'Mage').data, name: 'Second Mage', classFeatures: [] } };
    f.index.set(secondMage.key, secondMage);
    f.state.classes[1] = { selectionId: 'second', classKey: secondMage.key, level: 1 };
    const combined = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(combined.character!.spellSlots!['Shared Spellcasting'].map(slot => slot.total)).toEqual([4, 3]);
  });

  it('removes empty slot source buckets when a spellcasting subclass is removed', () => {
    const f = fixture();
    const subclass = { ...f.find('subclass', 'School'), key: 'eldritch-knight-test', name: 'Eldritch Knight',
      data: { name: 'Eldritch Knight', shortName: 'EK', source: 'TEST', className: 'Fighter',
        classSource: 'TEST', casterProgression: '1/3', spellcastingAbility: 'int', subclassFeatures: [] } };
    f.index.set(subclass.key, subclass);
    f.state.classes = [{ selectionId: 'fighter', classKey: f.find('class', 'Fighter').key,
      subclassKey: subclass.key, level: 3 }];
    const first = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(Object.values(first.character!.spellSlots!).flat().length).toBeGreaterThan(0);
    const nextState = structuredClone(first.creatorWizard!);
    delete nextState.classes[0].subclassKey;
    const next = previewClassWizard(first, nextState, f.revision, f.index).sheet;
    expect(next.character!.spellSlots).toBeUndefined();
  });

  it('honors unchecked sections and retains consumed resources when their class is removed', () => {
    const f = fixture(); f.state.options = { features: false, spells: false, proficiencies: false };
    const hpOnly = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    expect(hpOnly.character!.maxHp).toBe(28); expect(hpOnly.features).toBeUndefined();
    expect(hpOnly.character!.featureSources).toBeUndefined(); expect(hpOnly.spells).toBeUndefined();
    f.state.options = {};
    const first = previewClassWizard(f.sheet, f.state, f.revision, f.index).sheet;
    (first.character!.hitDice as { used: number }[])[0].used = 1;
    first.character!.spellSlots!['Mage (TEST)'][0].used = 1;
    const state = structuredClone(first.creatorWizard!); state.classes.shift();
    const next = previewClassWizard(first, state, f.revision, f.index).sheet;
    expect((next.character!.hitDice as { dieType: string; used: number }[]).find(die => die.dieType === 'd6')!.used).toBe(1);
    expect(next.character!.spellSlots!['Mage (TEST)'][0].used).toBe(1);
    expect(next.character!.featureSources!.some(source => source.name === 'Mage (TEST)')).toBe(true);
  });

  it('prefills current identity on each opening while preserving class choices and custom rows', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache();
    await cache.stage({ ...f.revision, status: 'staging' });
    await cache.put(f.revision.id, f.records); await cache.activate(f.revision);
    await cache.saveSource('development-local', f.revision.source);
    f.sheet.creatorWizard = structuredClone(f.state);
    f.sheet.classes = [
      { name: 'Mage', classKey: f.state.classes[0].classKey, level: 7 },
      { name: 'Storyteller', custom: true, level: 2 },
    ];
    f.sheet.species = { name: 'Elf', contentReference: { key: 'species-test', revisionId: f.revision.id, sourceIdentity: f.revision.sourceIdentity, commit: f.revision.commit } };
    f.sheet.background = { name: 'Custom history' };
    const original = structuredClone(f.sheet);
    const open = async () => {
      const component = TestBed.createComponent(ClassWizardComponent);
      component.componentRef.setInput('sheet', f.sheet); await component.whenStable();
      await component.componentInstance.loadContent();
      return component;
    };
    const first = await open(); const wizard = first.componentInstance;
    expect(wizard.state.classes).toEqual([{ ...f.state.classes[0], level: 7, subclassKey: undefined }]);
    expect(wizard.state.speciesKey).toBe('species-test');
    expect(wizard.state.customBackgroundName).toBe('Custom history');
    expect(wizard.state.backgroundKey).toBeUndefined();
    expect(f.sheet).toEqual(original);
    wizard.state.classes[0].level = 9;
    await wizard.loadContent(true);
    expect(wizard.state.classes[0].level).toBe(9);
    first.destroy();
    f.sheet.classes[0].level = 8;
    f.sheet.classes[0].subclassKey = f.find('subclass', 'School').key;
    delete f.sheet.species; delete f.sheet.background;
    const second = await open();
    expect(second.componentInstance.state.classes[0].level).toBe(8);
    expect(second.componentInstance.state.classes[0].subclassKey).toBe(f.find('subclass', 'School').key);
    expect(second.componentInstance.state.speciesKey).toBeUndefined();
    expect(second.componentInstance.state.customBackgroundName).toBeUndefined();
  });

  it('can switch to the current library and back to the saved library without applying', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache();
    await cache.stage({ ...f.revision, status: 'staging' });
    await cache.put(f.revision.id, f.records); await cache.activate(f.revision);
    const current = { ...f.revision, id: crypto.randomUUID() };
    await cache.stage({ ...current, status: 'staging' });
    await cache.put(current.id, f.records); await cache.activate(current);
    await cache.saveSource('development-local', current.source);
    f.sheet.creatorWizard = { ...f.state, revisionId: f.revision.id };
    const component = TestBed.createComponent(ClassWizardComponent);
    component.componentRef.setInput('sheet', f.sheet); await component.whenStable();
    const wizard = component.componentInstance;
    await wizard.loadContent();
    expect(wizard.revision()?.id).toBe(f.revision.id);
    await wizard.loadContent(true);
    expect(wizard.revision()?.id).toBe(current.id);
    expect(wizard.differentRevision).toBe(true);
    expect(wizard.savedRevisionAvailable).toBe(true);
    await wizard.loadContent();
    expect(wizard.revision()?.id).toBe(f.revision.id);
    expect(wizard.differentRevision).toBe(false);
    expect(f.sheet.creatorWizard.revisionId).toBe(f.revision.id);
  });

  it('loads the pinned local library, restricts subclass choices, reviews and applies a detached draft', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache();
    await cache.stage({ ...f.revision, status: 'staging' }); await cache.put(f.revision.id, f.records); await cache.activate(f.revision);
    await cache.saveSource('development-local', f.revision.source);
    const component = TestBed.createComponent(ClassWizardComponent); component.componentRef.setInput('sheet', f.sheet);
    await component.whenStable(); await component.componentInstance.loadContent();
    const wizard = component.componentInstance; wizard.addClass(); wizard.selectClass(wizard.state.classes[0], f.find('class', 'Mage').key);
    f.sheet.character!.maxHp = 50; wizard.rebuild();
    expect(wizard.overrideSections).toEqual([]);
    expect(wizard.proposal()!.sheet.character!.maxHp).toBe(50);
    wizard.stage = 1;
    component.changeDetectorRef.markForCheck(); await component.whenStable();
    const override = component.nativeElement.querySelector('input[aria-label="Override manual edits for Maximum HP"]');
    override.click(); await component.whenStable();
    expect(wizard.overrideSections).toEqual(['hp']);
    expect(wizard.proposal()!.sheet.character!.maxHp).toBe(8);
    expect(f.sheet.character!.maxHp).toBe(50);
    wizard.state.options['hp'] = false; wizard.rebuild();
    expect(wizard.overrideSections).toEqual([]);
    expect(wizard.proposal()!.sheet.character!.maxHp).toBe(50);
    wizard.state.options['hp'] = true; wizard.stage = 0;
    expect(wizard.subclasses(wizard.state.classes[0]).map(record => record.name)).toEqual(['School']);
    wizard.advance(); expect(wizard.stage).toBe(1);
    const choice = wizard.proposal()!.choices.find(choice => choice.label.endsWith(': skill proficiencies'))!;
    wizard.toggleChoice(choice, 'arcana'); expect(wizard.choiceComplete(choice)).toBe(true);
    wizard.advance(); expect(wizard.stage).toBe(2);
    let applied = f.sheet; wizard.applied.subscribe(value => applied = value); wizard.apply();
    expect(applied.character!.level).toBe(1); expect(applied.character!.maxHp).toBe(8);
    expect(f.sheet.character!.maxHp).toBe(50);
  });
});
