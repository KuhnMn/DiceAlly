import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { emptyBasicCharacter } from './basic-info';
import { FeatureSource, SpellEntryFull } from '../models/character.model';
import { sourceAbilities } from '../models/feature-source-abilities';
import { cycleSourceAbility, sourceAbilityState } from './source-ability-selection';
import { featureSourceStats, sourceCombatStats } from './feature-source-stats';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';
import { spellCastingStats } from './spell-source-stats';
import { prefillCombatAction } from './combat-actions';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { portableCharacter } from '../characters/portable-character';

describe('Scoped source abilities', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  const source = (): FeatureSource => ({ name: 'Dual source', isGeneralFeatureSource: true, isSpellcastingSource: true,
    associatedAbilities: { features: [], spellcasting: [] } });

  it('cycles through all four scopes with separate feature, spellcasting and diagonal button styles', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent), sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [source()];
    fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('panel', 'sources'); await fixture.whenStable();
    const ability = fixture.nativeElement.querySelector('button[aria-label="DEX: Not used"]') as HTMLButtonElement;
    const entry = sheet.character!.featureSources![0];
    for (const [state, style, label] of [
      ['features', 'source-ability-features', 'Features'], ['spellcasting', 'source-ability-spellcasting', 'Spellcasting'],
      ['both', 'source-ability-both', 'Features and Spellcasting'], ['none', '', 'Not used'],
    ] as const) {
      ability.click(); fixture.detectChanges();
      expect(sourceAbilityState(entry, 'dexterity')).toBe(state);
      expect(ability.getAttribute('aria-label')).toBe(`DEX: ${label}`);
      if (style) expect(ability.classList.contains(style)).toBe(true);
      expect(ability.getAttribute('aria-pressed')).toBe(state === 'none' ? 'false' : 'true');
    }
    expect(entry.associatedAbilities).toEqual({ features: [], spellcasting: [] });
  });

  it('toggles one scope independently and preserves dormant assignments when changing provided categories', () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent), sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet);
    const entry = source(), editor = fixture.componentInstance;
    editor.setSourceProvides(entry, 'spellcasting', false);
    cycleSourceAbility(entry, 'dexterity');
    expect(entry.associatedAbilities).toEqual({ features: ['dexterity'], spellcasting: [] });
    cycleSourceAbility(entry, 'dexterity'); expect(entry.associatedAbilities!.features).toEqual([]);
    cycleSourceAbility(entry, 'dexterity');
    editor.setSourceProvides(entry, 'spellcasting', true);
    expect(sourceAbilityState(entry, 'dexterity')).toBe('features');
    editor.setSourceProvides(entry, 'features', false);
    cycleSourceAbility(entry, 'wisdom');
    expect(sourceAbilityState(entry, 'wisdom')).toBe('spellcasting');
    expect(sourceAbilities(entry, 'features')).toEqual([]);
    editor.setSourceProvides(entry, 'features', true);
    expect(sourceAbilityState(entry, 'dexterity')).toBe('features');
    expect(sourceAbilityState(entry, 'wisdom')).toBe('spellcasting');
  });

  it('filters source cards by page and uses the highest eligible value for each calculation', () => {
    const sheet = emptyBasicCharacter(), entry = source(), helpers = TestBed.inject(CharacterHelpersService);
    entry.associatedAbilities = { features: ['dexterity', 'wisdom'], spellcasting: ['wisdom', 'intelligence'] };
    sheet.character!.featureSources = [entry]; sheet.character!.level = 5;
    sheet.character!.abilityScores = { dexterity: 20, wisdom: 14, intelligence: 16 };
    expect(featureSourceStats(entry, sheet.character!, helpers, 'features').map(stat => stat.ability)).toEqual(['DEX', 'WIS']);
    expect(featureSourceStats(entry, sheet.character!, helpers, 'spellcasting').map(stat => stat.ability)).toEqual(['INT', 'WIS']);
    expect(sourceCombatStats(entry, sheet.character!, helpers, 'features')).toEqual({ attackModifier: 8, savingThrowDifficulty: 16 });
    expect(spellCastingStats(sheet, entry.name, helpers)).toEqual({ attackModifier: 6, savingThrowDifficulty: 14 });
    const picker = TestBed.createComponent(FeatureSourcePickerComponent);
    picker.componentRef.setInput('character', sheet.character!); picker.componentRef.setInput('sources', [entry]);
    expect(picker.componentInstance.stats(entry).map(stat => stat.ability)).toEqual(['DEX', 'WIS']);
    picker.componentRef.setInput('tone', 'spells');
    expect(picker.componentInstance.stats(entry).map(stat => stat.ability)).toEqual(['INT', 'WIS']);
    const spell: SpellEntryFull = { name: 'Test spell', castingSourceName: entry.name,
      entity: { name: 'Test spell', source: 'TEST', level: 1, school: 'V', time: [], range: {}, components: {}, duration: [], entries: [], savingThrow: ['wisdom'], spellAttack: ['R'] } };
    expect(prefillCombatAction(sheet, spell, 'SPELL', helpers).hitOrDc).toBe('+6 to hit / DC 14 Wisdom');
    const feature = { name: 'Test feature', featureSourceName: entry.name, featureEntity: { name: 'Test feature', source: 'TEST', level: 1, className: 'Test', classSource: 'TEST', entries: ['Target makes a Wisdom saving throw.'] } };
    expect(prefillCombatAction(sheet, feature, 'CLASS_FEATURE', helpers).hitOrDc).toBe('DC 16 Wisdom');
    entry.associatedAbilities.features = []; entry.associatedAbilities.spellcasting = [];
    expect(featureSourceStats(entry, sheet.character!, helpers)).toEqual([]);
    expect(spellCastingStats(sheet, entry.name, helpers)).toBeUndefined();
  });

  it('reads historical shared flags without changing a snapshot, then writes only scoped assignments when edited', async () => {
    const entry: FeatureSource = { name: 'Legacy source', isGeneralFeatureSource: true, isSpellcastingSource: true, usesIntelligence: true };
    const original = structuredClone(entry);
    expect(sourceAbilities(entry, 'features')).toEqual(['intelligence']);
    expect(sourceAbilities(entry, 'spellcasting')).toEqual(['intelligence']);
    expect(entry).toEqual(original);
    cycleSourceAbility(entry, 'dexterity'); // None -> Features, retaining existing INT assignments in both scopes.
    expect(entry).not.toHaveProperty('usesIntelligence');
    expect(entry.associatedAbilities).toEqual({ features: ['intelligence', 'dexterity'], spellcasting: ['intelligence'] });
    const sheet = emptyBasicCharacter(); sheet.character!.featureSources = [entry];
    const repository = new IndexedDbCharacterRepository(`source-scopes-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!;
    const decoded = await decodeCloudCharacter(saved.id, await encodeCloudCharacter(saved, 1));
    expect(decoded.sheet.character!.featureSources![0]).toEqual(entry);
    expect(portableCharacter(JSON.parse(JSON.stringify(sheet))).character!.featureSources![0]).toEqual(entry);
    entry.associatedAbilities!.spellcasting.push('invalid' as 'wisdom');
    expect(() => portableCharacter(sheet)).toThrow('Invalid spellcasting abilities');
  });
});
