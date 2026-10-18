import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocalEditorComponent } from './local-editor.component';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { By } from '@angular/platform-browser';
import { SwipePagesDirective } from '../sheet/swipe-pages.directive';

describe('Basic Info editor', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [LocalEditorComponent], providers: [provideRouter([])] }));

  it('navigates by page swipes while retaining edits and respecting tab bounds and save state', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const swipe = fixture.debugElement.query(By.directive(SwipePagesDirective)).injector.get(SwipePagesDirective);
    editor.character.name = 'Unsaved Name';
    swipe.pageSwipe.emit(-1); expect(editor.page).toBe(0);
    swipe.pageSwipe.emit(1); expect(editor.page).toBe(1);
    swipe.pageSwipe.emit(-1); expect(editor.page).toBe(0);
    expect(editor.character.name).toBe('Unsaved Name');
    editor.setPage(editor.pages.length - 1);
    swipe.pageSwipe.emit(1); expect(editor.page).toBe(editor.pages.length - 1);
    editor.busy.set(true);
    swipe.pageSwipe.emit(-1); expect(editor.page).toBe(editor.pages.length - 1);
  });

  it('groups the editor into nine tabs with separate species/features and spells pages', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(fixture.nativeElement.querySelectorAll('nav[aria-label="Character editor pages"] button')).toHaveLength(9);
    expect(fixture.nativeElement.querySelector('#new-hit-dice-total')).not.toBeNull();
    editor.setPage(2); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#skill-PERCEPTION')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#save-wis')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-other-proficiencies')).not.toBeNull();
    editor.setPage(4); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-species')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-editor-features')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-editor-spells')).toBeNull();
    editor.setPage(5); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-spells')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-editor-features')).toBeNull();
    editor.setPage(6); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-items')).not.toBeNull();
    editor.setPage(7); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-monsters')).not.toBeNull();
    editor.setPage(8); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-combat')).not.toBeNull();
    const pages = [...editor.pages];
    editor.character.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }];
    expect(editor.pages).toEqual(pages);
  });

  it('toggles full saving throw proficiency and preserves signed bonuses and other pages', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.level = 5; editor.abilityScores.wisdom = 16;
    editor.setSkillLevel('STEALTH', 'EXPERTISE');
    editor.setSaveBonus('wis', -1); expect(editor.saveTotal('wisdom')).toBe('+2');
    editor.toggleSaveProficiency('wis'); expect(editor.saveTotal('wisdom')).toBe('+5');
    editor.toggleSaveProficiency('wis'); expect(editor.saveProficient('wis')).toBe(false);
    editor.toggleSaveProficiency('wis'); editor.setPage(2);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('button[id^="save-"]').length).toBe(6);
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.saveProficient('wis')).toBe(true); expect(editor.saveBonus('wis')).toBe(-1);
    expect(editor.skillLevel('STEALTH')).toBe('EXPERTISE');
    editor.setSaveBonus('wis', null); expect(editor.saveBonus('wis')).toBe(0);
  });

  it('opens without imported content and renders only the requested first page', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect([...page.querySelectorAll('h2')].map(h => h.textContent?.trim())).toEqual([
      'Basic Information', 'Portrait', 'Combat Stats', 'Hit Dice', 'Armor Class', 'General Stats',
    ]);
    expect(page.querySelector('#speed-walk')).toBeTruthy();
    expect(page.textContent).not.toMatch(/grant|preview|structured editing/i);
    expect(fixture.componentInstance.character.level).toBe(1);
    expect(fixture.componentInstance.character.speeds?.walk).toBe(30);
    const senseName = page.querySelector('input[name="sense-name"]') as HTMLInputElement;
    const addSense = senseName.closest('div')!.querySelector('button') as HTMLButtonElement;
    expect(addSense.disabled).toBe(true);
    senseName.value = 'Darkvision'; senseName.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable(); expect(addSense.disabled).toBe(false);
  });

  it('saves and reopens manual fields with no class or compendium requirement', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Aster'; editor.character.level = 7; editor.character.maxHp = 43;
    editor.character.armorClass = 18; editor.character.description = 'Scout';
    editor.sheet.portaitUrl = 'data:image/png;base64,aGVsbG8=';
    editor.resistanceInput = 'Poison'; editor.addResistance();
    editor.senseName = 'Darkvision'; editor.senseRange = 120; editor.addSense();
    editor.speeds.fly = 40; editor.speeds.swim = 20; editor.speeds.burrow = 10;
    await editor.save();
    expect(editor.error()).toBe(''); expect(editor.unsaved).toBe(false);
    const entry = (await new IndexedDbCharacterRepository().list()).find(e => e.id === editor.character.characterUuid)!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.character).toMatchObject({ name: 'Aster', level: 7, maxHp: 43, armorClass: 18,
      resistances: ['Poison'], senses: { Darkvision: 120 }, speeds: { walk: 30, fly: 40, swim: 20, burrow: 10 } });
    expect(editor.sheet.portaitUrl).toBe(entry.sheet.portaitUrl);
  });

  it('calculates unarmored defense from the selected ability and keeps manual AC independent', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.abilityScores!.dexterity = 14; editor.character.abilityScores!.wisdom = 18;
    editor.character.armorClass = 17;
    editor.setAutomaticAc(true); editor.setUnarmoredDefense(true); editor.setDefenseAbility('wisdom');
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(editor.calculatedAc.ac).toBe(16);
    expect(editor.character.unarmoredDefense).toBe('WISDOM');
    editor.setAutomaticAc(false);
    expect(editor.character.armorClass).toBe(17);
    await editor.save();
    expect(editor.character.armorClass).toBe(17);
    expect(editor.error()).toBe('');
  });

  it('rejects invalid values and stale saves without losing an existing character', async () => {
    const repository = new IndexedDbCharacterRepository(); const sheet = emptyBasicCharacter();
    await repository.save(sheet, 0);
    sheet.character!.maxHp = -1;
    expect(() => validateBasicInfo(sheet)).toThrow('Maximum HP');
    sheet.character!.maxHp = 10;
    await expect(repository.save(sheet, 0)).rejects.toThrow('another tab');
    expect((await repository.list()).find(e => e.id === sheet.character!.characterUuid)?.sheet.character?.maxHp).toBe(0);
  });

  it('handles Android enum and earlier object representations of unarmored defense', () => {
    const helpers = TestBed.inject(CharacterHelpersService);
    const sheet = emptyBasicCharacter(); sheet.character!.abilityScores!.constitution = 16;
    sheet.character!.unarmoredDefense = 'CONSTITUTION';
    expect(helpers.calculateArmorClass(sheet.character!, []).ac).toBe(13);
    sheet.character!.unarmoredDefense = { constitution: 1 };
    expect(helpers.calculateArmorClass(sheet.character!, []).ac).toBe(13);
  });

  it('keeps both pages together, persists six scores, and uses them for calculated AC', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Ability test'; editor.character.maxHp = 24;
    editor.setAutomaticAc(true); editor.setUnarmoredDefense(true); editor.setDefenseAbility('wisdom');
    editor.setPage(1);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const scores = [12, 14, 16, 8, 18, 10];
    editor.defenseAbilities.forEach((ability, i) => {
      const input = fixture.nativeElement.querySelector(`#ability-${ability.key}`) as HTMLInputElement;
      expect(input).toBeTruthy();
      input.value = String(scores[i]); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await fixture.whenStable();
    editor.adjustAbility('strength', 1);
    expect(editor.abilityScores.strength).toBe(13);
    expect(editor.abilityModifier('wisdom')).toBe('+4');
    editor.setPage(0);
    expect(editor.character.name).toBe('Ability test'); expect(editor.calculatedAc.ac).toBe(16);
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry); editor.setPage(1);
    expect(editor.abilityScores).toEqual({ strength: 13, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 18, charisma: 10 });
    expect(editor.character.maxHp).toBe(24);
  });

  it('adds and merges hit dice, preserves usage during edits, and saves across pages', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Hit dice test'; editor.setPage(0);
    editor.hitDiceTotal = 3; editor.hitDiceType = 'd8'; editor.addHitDice();
    editor.hitDice[0].used = 2;
    editor.hitDiceTotal = 2; editor.hitDiceType = 'D8'; editor.addHitDice();
    expect(editor.hitDice).toEqual([{ total: 5, used: 2, dieType: 'd8', userAdded: true }]);
    editor.adjustHitDice(0, -1);
    expect(editor.hitDice[0]).toMatchObject({ total: 4, used: 2 });
    editor.hitDiceTotal = 1; editor.hitDiceType = 'd10'; editor.addHitDice();
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('#new-hit-dice-total').length).toBe(1);
    editor.setPage(0); await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.hitDice).toHaveLength(2); expect(editor.hitDice[0].used).toBe(2);
    editor.removeHitDice(1); expect(editor.hitDice).toHaveLength(1);
  });

  it('rejects invalid hit-dice additions without mutating the character', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.hitDiceTotal = 0; editor.addHitDice();
    expect(editor.hitDice).toEqual([]); expect(editor.error()).toMatch(/positive/);
    editor.hitDiceTotal = 1; editor.hitDiceType = 'not dice'; editor.addHitDice();
    expect(editor.hitDice).toEqual([]);
  });

  it('supports every skill proficiency rank and signed bonuses with persistent sheet keys', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.level = 5; editor.abilityScores.dexterity = 14;
    editor.character.proficiencies = { savingThrows: ['WIS'], custom: ['Keep'] };
    editor.setSkillBonus('STEALTH', -1);
    for (const [rank, total] of [['NONE', '+1'], ['HALF', '+2'], ['PROFICIENT', '+4'], ['EXPERTISE', '+7']]) {
      editor.setSkillLevel('STEALTH', rank);
      expect(editor.skillTotal('STEALTH', 'dex')).toBe(total);
    }
    editor.setPage(2); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('button[id^="skill-"]').length).toBe(18);
    editor.cycleSkillLevel('STEALTH'); expect(editor.skillLevel('STEALTH')).toBe('NONE');
    editor.cycleSkillLevel('STEALTH'); expect(editor.skillLevel('STEALTH')).toBe('HALF');
    editor.cycleSkillLevel('STEALTH'); expect(editor.skillLevel('STEALTH')).toBe('PROFICIENT');
    editor.cycleSkillLevel('STEALTH'); expect(editor.skillLevel('STEALTH')).toBe('EXPERTISE');
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.skillLevel('STEALTH')).toBe('EXPERTISE'); expect(editor.skillBonus('STEALTH')).toBe(-1);
    expect(editor.character.proficiencies?.savingThrows).toEqual(['WIS']);
    editor.setSkillBonus('STEALTH', null); expect(editor.skillBonus('STEALTH')).toBe(0);
  });
});
