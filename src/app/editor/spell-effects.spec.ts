import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapContent } from '../content/content-adapter';
import { canonicalSpellRecord } from '../content/spell-adapter';
import { matchesSpellEffects, prepareSpellEffects, spellEffectFilterCount, spellEffectSummary } from '../content/spell-effects';
import { matchesSpell, spellSnapshot } from './spell-selection';
import { emptyBasicCharacter } from './basic-info';
import { prefillCombatAction, combatSourceSuggestion } from './combat-actions';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { SpellsPageComponent } from '../sheet/spells-page.component';
import { SpellsEditorComponent } from './spells-editor.component';
import { SpellDetailsComponent } from '../sheet/spell-details.component';
import { SpellEffectFilterComponent } from '../spell-effect-filter.component';
import { SpellEntity, SpellEntryFull } from '../models/character.model';
import { spellCastingStats } from './spell-source-stats';

function spell(name: string, fields: Partial<SpellEntity>): SpellEntity {
  return { name, source: 'XPHB', level: 1, school: 'V', time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 60 } }, components: { v: true }, duration: [{ type: 'instant' }], entries: [], ...fields };
}
const fireball = () => spell('Fireball', { level: 3, damageInflict: ['fire'], savingThrow: ['dexterity'], areaTags: ['S'],
  entries: ['Each creature makes a Dexterity saving throw, taking {@damage 8d6} Fire damage.'] });
const holdPerson = () => spell('Hold Person', { level: 2, school: 'E', savingThrow: ['wisdom'], conditionInflict: ['paralyzed'], areaTags: ['ST'], entries: ['The target makes a Wisdom saving throw.'] });
const entry = (entity: SpellEntity): SpellEntryFull => ({ editorId: entity.name, name: entity.name, source: entity.source, castingSourceName: 'Wizard', listType: 'PREPARED', entity });

describe('Structured spell effects', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('matches any choice within a group and all selected groups, without guessing missing metadata', () => {
    const filter = { damageTypes: ['fire', 'cold'], savingThrows: ['dexterity'], areas: ['S'] };
    expect(matchesSpellEffects(fireball(), filter)).toBe(true);
    expect(matchesSpellEffects(holdPerson(), filter)).toBe(false);
    expect(matchesSpellEffects(spell('Prose only', { entries: ['Fire damage, Dexterity save, sphere'] }), filter)).toBe(false);
    expect(matchesSpellEffects(undefined, filter)).toBe(false);
    expect(matchesSpellEffects({ savingThrow: ['dex'] }, { savingThrows: ['dexterity'] })).toBe(true);
    expect(spellEffectFilterCount(filter)).toBe(4);
  });

  it('keeps effect metadata through canonical adaptation and snapshot export, and applies it to catalog searches', () => {
    const source = fireball();
    const record = canonicalSpellRecord(mapContent({ spell: [source] }, 'spells.json').records[0]);
    const before = structuredClone(record);
    expect(matchesSpell(record, { search: '', levels: [3], classes: [], effects: { damageTypes: ['fire'], areas: ['S'] } })).toBe(true);
    expect(matchesSpell(record, { search: '', levels: [], classes: [], effects: { conditions: ['paralyzed'] } })).toBe(false);
    expect(spellSnapshot(record)).toMatchObject({ savingThrow: ['dexterity'], damageInflict: ['fire'], areaTags: ['S'] });
    expect(JSON.parse(JSON.stringify(spellSnapshot(record))).savingThrow).toEqual(['dexterity']);
    expect(record).toEqual(before);
  });

  it('shows a compact effect strip without repeating ritual, duration or component metadata', () => {
    const fixture = TestBed.createComponent(SpellDetailsComponent);
    fixture.componentRef.setInput('spell', holdPerson()); fixture.detectChanges();
    const strip = fixture.nativeElement.querySelector('[aria-label="Spell effects"]') as HTMLElement;
    expect(strip.textContent).toContain('Save: Wisdom');
    expect(strip.textContent).toContain('May cause: Paralyzed');
    expect(strip.textContent).not.toContain('Single target');
    expect(strip.querySelectorAll('dt').length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('Material Cost');
    fixture.componentRef.setInput('spell', spell('Utility', {})); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Spell effects"]')).toBeNull();
    expect((fixture.nativeElement.querySelector('app-spell-effect-summary') as HTMLElement).style.display).toBe('none');
    expect(spellEffectSummary({ miscTags: ['HL', 'THP'] })).toEqual([{ label: 'Effect', text: 'Healing / Temporary HP' }]);
  });

  it('filters the creator and viewer consistently and clears effect filters with the other filters', async () => {
    const sheet = emptyBasicCharacter(); sheet.spells = [entry(fireball()), entry(holdPerson())];
    const viewer = TestBed.createComponent(SpellsPageComponent);
    viewer.componentRef.setInput('characterData', sheet); viewer.detectChanges();
    viewer.componentInstance.spellEffects.set({ conditions: ['paralyzed'] }); viewer.detectChanges();
    expect(viewer.componentInstance.spells().map(spell => spell.name)).toEqual(['Hold Person']);
    expect(viewer.componentInstance.activeFilterCount()).toBe(1);
    viewer.componentInstance.clearFilters(); expect(viewer.componentInstance.spells()).toHaveLength(2);
    const creator = TestBed.createComponent(SpellsEditorComponent);
    creator.componentRef.setInput('sheet', sheet); await creator.whenStable();
    creator.componentInstance.displayedEffects = { damageTypes: ['fire'] };
    expect(creator.componentInstance.selected.map(spell => spell.name)).toEqual(['Fireball']);
    creator.componentInstance.filter.effects = { conditions: ['paralyzed'] };
    creator.componentInstance.clearCatalogFilters(); expect(creator.componentInstance.filter.effects).toBeUndefined();
  });

  it('offers collapsed filter groups with independent selections and accessible toggle state', () => {
    const fixture = TestBed.createComponent(SpellEffectFilterComponent); fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('details')].every((details: HTMLDetailsElement) => !details.open)).toBe(true);
    const fire = [...fixture.nativeElement.querySelectorAll('button')].find((button: HTMLButtonElement) => button.textContent?.trim() === 'Fire') as HTMLButtonElement;
    fire.click(); fixture.detectChanges();
    expect(fire.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.selected()).toEqual({ damageTypes: ['fire'] });
    fixture.componentInstance.clear('damageTypes'); fixture.detectChanges();
    expect(fire.getAttribute('aria-pressed')).toBe('false');
  });

  it('prefills saves, conditions, geometry and known source DC without taking unrelated numbers from prose', () => {
    const sheet = emptyBasicCharacter(); sheet.character!.abilityScores = { intelligence: 18 }; sheet.character!.level = 5;
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true, usesIntelligence: true }];
    const helpers = TestBed.inject(CharacterHelpersService), source = fireball();
    source.entries.push('An unrelated creature has {@dc 20} and rolls {@dice 1d100}.');
    const action = prefillCombatAction(sheet, entry(source), 'SPELL', helpers);
    expect(action).toMatchObject({ actionType: 'ACTION', hitOrDc: 'DC 15 Dexterity', range: '60 feet · Sphere', damageOrHeal: '8d6 Fire' });
    expect(prefillCombatAction(sheet, entry(holdPerson()), 'SPELL', helpers).damageOrHeal).toBe('May cause: Paralyzed');
    const noSource = entry(holdPerson()); noSource.castingSourceName = 'Missing';
    expect(prefillCombatAction(sheet, noSource, 'SPELL', helpers).hitOrDc).toBe('DC ? Wisdom');
  });

  it('uses explicit cantrip scaling tables, keeps independent attacks independent, and preserves manual Combat text', () => {
    const sheet = emptyBasicCharacter(); sheet.character!.level = 5;
    const source = entry(spell('Fire Bolt', { level: 0, spellAttack: ['R'], damageInflict: ['fire'], entries: ['Deal {@damage 1d10} Fire damage.'],
      scalingLevelDice: { label: 'Fire damage', scaling: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' } } }));
    sheet.spells = [source];
    const helpers = TestBed.inject(CharacterHelpersService), action = prefillCombatAction(sheet, source, 'SPELL', helpers);
    expect(action.damageOrHeal).toBe('2d10 Fire');
    expect(action.hitOrDc).toBe('Ranged spell attack');
    action.damageOrHeal = 'My reminder'; sheet.combatActions = [action]; sheet.character!.level = 11;
    expect(combatSourceSuggestion(sheet, action, helpers)?.damageOrHeal).toBe('3d10 Fire');
    expect(action.damageOrHeal).toBe('My reminder');
    const blast = entry(spell('Eldritch Blast', { level: 0, damageInflict: ['force'], entries: ['Each beam deals {@damage 1d10} Force damage.'] }));
    expect(prefillCombatAction(sheet, blast, 'SPELL', helpers).damageOrHeal).toBe('1d10 Force');
    expect(prepareSpellEffects({ savingThrow: ['DEX', 'dexterity'] }).savingThrows).toEqual(['Dexterity']);
  });

  it('shows linked-source attack/DC values in details and Combat using the higher configured ability', () => {
    const sheet = emptyBasicCharacter(); sheet.character!.level = 5;
    sheet.character!.abilityScores = { intelligence: 14, wisdom: 20, charisma: 30 };
    sheet.character!.featureSources = [
      { name: 'Wizard', isSpellcastingSource: true, usesIntelligence: true, usesWisdom: true },
      { name: 'Other caster', isSpellcastingSource: true, usesCharisma: true },
    ];
    const combined = entry(spell('Attack and save', { spellAttack: ['R'], savingThrow: ['constitution'] }));
    sheet.spells = [combined];
    const helpers = TestBed.inject(CharacterHelpersService);
    const before = structuredClone(sheet);
    expect(spellCastingStats(sheet, 'Wizard', helpers)).toEqual({ attackModifier: 8, savingThrowDifficulty: 16 });
    expect(prefillCombatAction(sheet, combined, 'SPELL', helpers).hitOrDc).toBe('+8 to hit / DC 16 Constitution');
    const viewer = TestBed.createComponent(SpellsPageComponent);
    viewer.componentRef.setInput('characterData', sheet); viewer.detectChanges();
    viewer.nativeElement.querySelector('h3 button[aria-haspopup="dialog"]').click(); viewer.detectChanges();
    const strip = viewer.nativeElement.querySelector('dialog [aria-label="Spell effects"]');
    expect(strip.textContent).toContain('Attack: Ranged +8 to hit');
    expect(strip.textContent).toContain('Save: DC 16 Constitution');
    expect(sheet).toEqual(before);
    const editor = TestBed.createComponent(SpellsEditorComponent); editor.componentRef.setInput('sheet', sheet);
    expect(editor.componentInstance.castingStats('Wizard')).toEqual({ attackModifier: 8, savingThrowDifficulty: 16 });
  });

  it('honors custom source overrides and does not invent an attack modifier from a DC-only or missing source', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'DC only', customDc: 17 },
      { name: 'Custom', usesIntelligence: true, usesWisdom: true, customToHit: 0, customDc: 12 }];
    const helpers = TestBed.inject(CharacterHelpersService);
    expect(spellCastingStats(sheet, 'DC only', helpers)).toEqual({ savingThrowDifficulty: 17 });
    expect(spellCastingStats(sheet, 'Custom', helpers)).toEqual({ attackModifier: 0, savingThrowDifficulty: 12 });
    expect(spellCastingStats(sheet, 'Missing', helpers)).toBeUndefined();
    expect(spellCastingStats(sheet, undefined, helpers)).toBeUndefined();
    const source = entry(spell('Attack', { spellAttack: ['R'] })); source.castingSourceName = 'DC only';
    expect(prefillCombatAction(sheet, source, 'SPELL', helpers).hitOrDc).toBe('Ranged spell attack');
  });
});
