import 'fake-indexeddb/auto';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocalEditorComponent } from './local-editor.component';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { By } from '@angular/platform-browser';
import { SwipePagesDirective } from '../sheet/swipe-pages.directive';
import { NgForm } from '@angular/forms';
import { walkingSpeedFeet, walkingSpeedEntry } from '../models/character-speed';
import { ClassWizardComponent } from './class-wizard.component';

describe('Basic Info editor', () => {
  beforeEach(async () => { await TestBed.configureTestingModule({ imports: [LocalEditorComponent], providers: [provideRouter([])] }).compileComponents(); });

  it('hands an applied wizard draft to the requested manual editor page without saving it', async () => {
    TestBed.configureTestingModule({ deferBlockBehavior: DeferBlockBehavior.Manual });
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.sheet.character!.name = 'Keep This Draft';
    editor.wizardOpen = true; fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const [block] = await fixture.getDeferBlocks(); await block.render(DeferBlockState.Complete);
    const wizard = fixture.debugElement.query(By.directive(ClassWizardComponent)).componentInstance as ClassWizardComponent;
    const draft = structuredClone(editor.sheet); draft.character!.maxHp = 28;
    wizard.applied.emit(draft); wizard.editRequested.emit('Spells'); await fixture.whenStable();
    expect(editor.sheet).toBe(draft); expect(editor.pages[editor.page]).toBe('Spells');
    expect(editor.wizardOpen).toBe(false); expect(editor.unsaved).toBe(true); expect(editor.version).toBe(0);
    expect(editor.character.name).toBe('Keep This Draft'); expect(editor.character.maxHp).toBe(28);
    fixture.destroy();
  });

  it('keeps the editor draft available when the deferred wizard cannot download', async () => {
    TestBed.configureTestingModule({ deferBlockBehavior: DeferBlockBehavior.Manual });
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Keep this draft';
    editor.wizardOpen = true;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    const [wizard] = await fixture.getDeferBlocks();
    await wizard.render(DeferBlockState.Loading);
    expect(fixture.nativeElement.textContent).toContain('Loading Class Wizard');
    await wizard.render(DeferBlockState.Error);
    expect(fixture.nativeElement.textContent).toContain('Save your changes');
    expect(editor.character.name).toBe('Keep this draft');
    const dismiss = [...fixture.nativeElement.querySelectorAll('button')].find((button: unknown) => (button as HTMLButtonElement).textContent?.trim() === 'Dismiss') as HTMLButtonElement;
    dismiss.click(); await fixture.whenStable();
    expect(editor.wizardOpen).toBe(false);
    expect(editor.character.name).toBe('Keep this draft');
  });

  it('saves manual walking references, conditions and hover without a species-copy button', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Structured movement';
    editor.basicInfo.addSpeed();
    const fly = editor.basicInfo.speeds.at(-1)!;
    editor.basicInfo.setSpeedCondition(fly, 'without heavy armor');
    editor.basicInfo.setSpeedHover(fly, true);
    await editor.save(); expect(editor.error()).toBe('');
    const record = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.open(record); await fixture.whenStable();
    expect(editor.character.speeds).toContainEqual({ id: fly.id, type: 'fly', value: { kind: 'walkingSpeed' }, condition: 'without heavy armor', canHover: true });
    expect(fixture.nativeElement.textContent).not.toContain('Use Species Speeds');
    const restored = editor.basicInfo.speeds.find(speed => speed.id === fly.id)!;
    editor.basicInfo.setSpeedType(restored, 'swim');
    expect(editor.basicInfo.speeds.find(speed => speed.id === fly.id)).not.toHaveProperty('canHover');
    editor.basicInfo.setSpeedFeet(editor.basicInfo.speeds.find(speed => speed.id === fly.id)!, 20);
    await editor.save(); expect(editor.error()).toBe('');
    expect(editor.character.speeds?.find(speed => speed.id === fly.id)?.value).toEqual({ kind: 'fixed', feet: 20 });
  });

  it('preserves base health and AC independently of temporary overrides through save and reopen', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const sheet = emptyBasicCharacter();
    Object.assign(sheet.character!, { maxHp: 52, maxHpOverride: 40, armorClass: 16, armorClassOverride: 19, calculateAC: false });
    const repository = new IndexedDbCharacterRepository();
    await repository.save(sheet, 0);
    editor.open((await repository.get(sheet.character!.characterUuid!))!, true);
    expect(editor.character.maxHp).toBe(52);
    expect(editor.character.armorClass).toBe(16);
    editor.character.name = 'Unrelated edit';
    await editor.save(); expect(editor.error()).toBe('');
    editor.open((await repository.get(sheet.character!.characterUuid!))!, true);
    expect(editor.character).toMatchObject({ maxHp: 52, maxHpOverride: 40, armorClass: 16, armorClassOverride: 19 });
    editor.character.maxHp = 55;
    await editor.save();
    expect((await repository.get(sheet.character!.characterUuid!))!.sheet.character).toMatchObject({ maxHp: 55, maxHpOverride: 40 });
  });

  it('keeps extracted page controls registered with the submit form and validates the active page', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    expect(form.controls['name']).toBeDefined();
    expect(form.controls['maxHp']).toBeDefined();
    const hp = fixture.nativeElement.querySelector('#maxHp') as HTMLInputElement;
    hp.value = ''; hp.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form.controls['maxHp'].hasError('required')).toBe(true);
    editor.setPage(1); await fixture.whenStable();
    expect(form.controls['maxHp']).toBeUndefined();
    expect(form.controls['ability-strength']).toBeDefined();
    editor.setPage(2); await fixture.whenStable();
    expect(form.controls['skill-bonus-STEALTH']).toBeDefined();
    expect(form.controls['save-bonus-wis']).toBeDefined();
  });

  it('retains unfinished basic inputs across tabs and follows a replacement sheet from the wizard', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const senseName = fixture.nativeElement.querySelector('input[name="sense-name"]') as HTMLInputElement;
    senseName.value = 'Darkvision'; senseName.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    editor.setPage(1); await fixture.whenStable();
    editor.setPage(0); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[name="sense-name"]').value).toBe('Darkvision');
    const original = editor.sheet;
    const replacement = emptyBasicCharacter();
    editor.applyWizard(replacement);
    editor.basicInfo.addSense();
    editor.abilities.adjustAbility('strength', 1);
    editor.proficiencies.setSkillLevel('STEALTH', 'EXPERTISE');
    expect(replacement.character!.senses!['Darkvision']).toBe(60);
    expect(replacement.character!.abilityScores!.strength).toBe(11);
    expect(replacement.character!.proficiencies!.skills!['STEALTH']).toBe('EXPERTISE');
    expect(original.character!.senses!['Darkvision']).toBeUndefined();
  });

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

  it('uses the mobile selector with the existing page state and preserves unfinished inputs', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const draft = fixture.nativeElement.querySelector('input[name="sense-name"]') as HTMLInputElement;
    draft.value = 'Unfinished sense'; draft.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('select[aria-label="Character editor page"]') as HTMLSelectElement;
    select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); await fixture.whenStable();
    expect(editor.page).toBe(1);
    select.value = '0'; select.dispatchEvent(new Event('change', { bubbles: true })); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[name="sense-name"]').value).toBe('Unfinished sense');
    editor.busy.set(true); await fixture.whenStable(); expect(select.disabled).toBe(true);
    fixture.nativeElement.querySelector('[aria-label="Next editor page"]').click(); expect(editor.page).toBe(0);
  });

  it('groups the editor into content pages with notes and sheet settings', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(fixture.nativeElement.querySelectorAll('nav[aria-label="Character editor pages"] button')).toHaveLength(12);
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
    expect(fixture.nativeElement.querySelector('app-editor-bastions')).not.toBeNull();
    editor.setPage(9); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-combat')).not.toBeNull();
    const pages = [...editor.pages];
    editor.character.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }];
    expect(editor.pages).toEqual(pages);
  });

  it('toggles full saving throw proficiency and preserves signed bonuses and other pages', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.level = 5; editor.abilities.abilityScores.wisdom = 16;
    editor.proficiencies.setSkillLevel('STEALTH', 'EXPERTISE');
    editor.proficiencies.setSaveBonus('wis', -1); expect(editor.proficiencies.saveTotal('wisdom')).toBe('+2');
    editor.proficiencies.toggleSaveProficiency('wis'); expect(editor.proficiencies.saveTotal('wisdom')).toBe('+5');
    editor.proficiencies.toggleSaveProficiency('wis'); expect(editor.proficiencies.saveProficient('wis')).toBe(false);
    editor.proficiencies.toggleSaveProficiency('wis'); editor.setPage(2);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('button[id^="save-"]').length).toBe(6);
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.proficiencies.saveProficient('wis')).toBe(true); expect(editor.proficiencies.saveBonus('wis')).toBe(-1);
    expect(editor.proficiencies.skillLevel('STEALTH')).toBe('EXPERTISE');
    editor.proficiencies.setSaveBonus('wis', null); expect(editor.proficiencies.saveBonus('wis')).toBe(0);
  });

  it('toggles automatic item save bonuses in Proficiencies and preserves the setting when saved and reopened', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.level = 5; editor.abilities.abilityScores.wisdom = 16;
    editor.proficiencies.toggleSaveProficiency('wis'); editor.proficiencies.setSaveBonus('wis', -1);
    editor.sheet.inventory = [{ name: 'Ring of Protection', source: 'XDMG', isEquipped: true, isAttuned: true,
      entity: { item: { name: 'Ring of Protection', source: 'XDMG', reqAttune: 'by anyone', bonusSavingThrow: '+1' } } }];
    editor.setPage(2); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const checkbox = fixture.nativeElement.querySelector('input[name="calculate-save-bonuses"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(editor.proficiencies.saveTotal('wisdom')).toBe('+5');
    checkbox.click(); await fixture.whenStable();
    expect(editor.character.calculateSavingThrowBonuses).toBe(true);
    expect(editor.proficiencies.saveTotal('wisdom')).toBe('+6');
    expect(fixture.nativeElement.querySelector('[aria-label="Wisdom saving throw total"]').textContent).toBe('+6');
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.character.calculateSavingThrowBonuses).toBe(true);
    expect(editor.proficiencies.saveTotal('wisdom')).toBe('+6');
    expect(editor.proficiencies.saveBonus('wis')).toBe(-1);
    editor.proficiencies.setAutomaticSaveBonuses(false);
    expect(editor.proficiencies.saveTotal('wisdom')).toBe('+5');
    fixture.destroy();
  });

  it('keeps setup help behind info buttons and retains the Class Wizard label for saved characters', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance, before = JSON.stringify(editor.sheet);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).not.toContain('Light armor uses Dexterity');
    const help = page.querySelector<HTMLButtonElement>('[aria-label="About Calculated armor class"]')!;
    expect(help.getAttribute('aria-haspopup')).toBe('dialog'); help.click(); await fixture.whenStable();
    const dialog = page.querySelector<HTMLElement>('app-info-button [role="dialog"]')!;
    expect(dialog.textContent).toContain('Light armor uses Dexterity');
    expect(dialog.textContent).toContain('Conditions and reminders do not add automatic modifiers');
    dialog.querySelector<HTMLButtonElement>('.catalog-header button')!.click(); await fixture.whenStable();
    expect(page.querySelector('app-info-button [role="dialog"]')).toBeNull();
    expect(JSON.stringify(editor.sheet)).toBe(before);
    editor.version = 1; fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(page.querySelector('.wizard-button')!.getAttribute('aria-label')).toBe('Class Wizard');
    expect(page.querySelectorAll('app-class-wizard')).toHaveLength(0);
  });

  it('opens without imported content and renders only the requested first page', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect([...page.querySelectorAll('h2')].map(h => h.textContent?.trim())).toEqual([
      'Basic Information', 'Combat Stats', 'Armor Class', 'Hit Dice', 'General Stats', 'Portrait',
    ]);
    expect(page.querySelector('#speed-walk')).toBeTruthy();
    expect(page.textContent).not.toMatch(/grant|preview|structured editing/i);
    expect(fixture.componentInstance.character.level).toBe(1);
    expect(walkingSpeedFeet(fixture.componentInstance.character.speeds)).toBe(30);
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
    editor.basicInfo.resistanceInput = 'Poison'; editor.basicInfo.addResistance();
    editor.basicInfo.senseName = 'Darkvision'; editor.basicInfo.senseRange = 120; editor.basicInfo.addSense();
    editor.basicInfo.speeds.push({ id: 'fly', type: 'fly', value: { kind: 'fixed', feet: 40 } },
      { id: 'swim', type: 'swim', value: { kind: 'fixed', feet: 20 } },
      { id: 'burrow', type: 'burrow', value: { kind: 'fixed', feet: 10 } });
    await editor.save();
    expect(editor.error()).toBe(''); expect(editor.unsaved).toBe(false);
    const entry = (await new IndexedDbCharacterRepository().list()).find(e => e.id === editor.character.characterUuid)!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.character).toMatchObject({ name: 'Aster', level: 7, maxHp: 43, armorClass: 18,
      resistances: ['Poison'], senses: { Darkvision: 120 }, speeds: [walkingSpeedEntry(),
        { id: 'fly', type: 'fly', value: { kind: 'fixed', feet: 40 } },
        { id: 'swim', type: 'swim', value: { kind: 'fixed', feet: 20 } },
        { id: 'burrow', type: 'burrow', value: { kind: 'fixed', feet: 10 } }] });
    expect(editor.sheet.portaitUrl).toBe(entry.sheet.portaitUrl);
  });

  it('calculates unarmored defense from the selected ability and keeps manual AC independent', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.abilityScores!.dexterity = 14; editor.character.abilityScores!.wisdom = 18;
    editor.character.armorClass = 17;
    editor.basicInfo.setAutomaticAc(true); editor.basicInfo.setUnarmoredDefense(true); editor.basicInfo.setDefenseAbility('wisdom');
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(editor.basicInfo.calculatedAc.ac).toBe(16);
    expect(editor.character.unarmoredDefense).toBe('WISDOM');
    editor.basicInfo.setAutomaticAc(false);
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
    editor.basicInfo.setAutomaticAc(true); editor.basicInfo.setUnarmoredDefense(true); editor.basicInfo.setDefenseAbility('wisdom');
    editor.setPage(1);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const scores = [12, 14, 16, 8, 18, 10];
    editor.abilities.defenseAbilities.forEach((ability, i) => {
      const input = fixture.nativeElement.querySelector(`#ability-${ability.key}`) as HTMLInputElement;
      expect(input).toBeTruthy();
      input.value = String(scores[i]); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await fixture.whenStable();
    editor.abilities.adjustAbility('strength', 1);
    expect(editor.abilities.abilityScores.strength).toBe(13);
    expect(editor.abilities.abilityModifier('wisdom')).toBe('+4');
    editor.setPage(0);
    expect(editor.character.name).toBe('Ability test'); expect(editor.basicInfo.calculatedAc.ac).toBe(16);
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry); editor.setPage(1);
    expect(editor.abilities.abilityScores).toEqual({ strength: 13, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 18, charisma: 10 });
    expect(editor.character.maxHp).toBe(24);
  });

  it('adds and merges hit dice, preserves usage during edits, and saves across pages', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Hit dice test'; editor.setPage(0);
    editor.basicInfo.hitDiceTotal = 3; editor.basicInfo.hitDiceType = 'd8'; editor.basicInfo.addHitDice();
    editor.basicInfo.hitDice[0].used = 2;
    editor.basicInfo.hitDiceTotal = 2; editor.basicInfo.hitDiceType = 'D8'; editor.basicInfo.addHitDice();
    expect(editor.basicInfo.hitDice).toEqual([{ total: 5, used: 2, dieType: 'd8', userAdded: true }]);
    editor.basicInfo.adjustHitDice(0, -1);
    expect(editor.basicInfo.hitDice[0]).toMatchObject({ total: 4, used: 2 });
    editor.basicInfo.hitDiceTotal = 1; editor.basicInfo.hitDiceType = 'd10'; editor.basicInfo.addHitDice();
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('#new-hit-dice-total').length).toBe(1);
    editor.setPage(0); await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.basicInfo.hitDice).toHaveLength(2); expect(editor.basicInfo.hitDice[0].used).toBe(2);
    editor.basicInfo.removeHitDice(1); expect(editor.basicInfo.hitDice).toHaveLength(1);
  });

  it('rejects invalid hit-dice additions without mutating the character', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.basicInfo.hitDiceTotal = 0; editor.basicInfo.addHitDice();
    expect(editor.basicInfo.hitDice).toEqual([]); expect(editor.error()).toMatch(/positive/);
    editor.basicInfo.hitDiceTotal = 1; editor.basicInfo.hitDiceType = 'not dice'; editor.basicInfo.addHitDice();
    expect(editor.basicInfo.hitDice).toEqual([]);
  });

  it('supports every skill proficiency rank and signed bonuses with persistent sheet keys', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.level = 5; editor.abilities.abilityScores.dexterity = 14;
    editor.character.proficiencies = { savingThrows: ['WIS'], custom: ['Keep'] };
    editor.proficiencies.setSkillBonus('STEALTH', -1);
    for (const [rank, total] of [['NONE', '+1'], ['HALF', '+2'], ['PROFICIENT', '+4'], ['EXPERTISE', '+7']]) {
      editor.proficiencies.setSkillLevel('STEALTH', rank);
      expect(editor.proficiencies.skillTotal('STEALTH', 'dex')).toBe(total);
    }
    editor.setPage(2); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('button[id^="skill-"]').length).toBe(18);
    editor.proficiencies.cycleSkillLevel('STEALTH'); expect(editor.proficiencies.skillLevel('STEALTH')).toBe('NONE');
    editor.proficiencies.cycleSkillLevel('STEALTH'); expect(editor.proficiencies.skillLevel('STEALTH')).toBe('HALF');
    editor.proficiencies.cycleSkillLevel('STEALTH'); expect(editor.proficiencies.skillLevel('STEALTH')).toBe('PROFICIENT');
    editor.proficiencies.cycleSkillLevel('STEALTH'); expect(editor.proficiencies.skillLevel('STEALTH')).toBe('EXPERTISE');
    await editor.save(); expect(editor.error()).toBe('');
    const entry = (await new IndexedDbCharacterRepository().get(editor.character.characterUuid!))!;
    editor.newCharacter(); editor.open(entry);
    expect(editor.proficiencies.skillLevel('STEALTH')).toBe('EXPERTISE'); expect(editor.proficiencies.skillBonus('STEALTH')).toBe(-1);
    expect(editor.character.proficiencies?.savingThrows).toEqual(['WIS']);
    editor.proficiencies.setSkillBonus('STEALTH', null); expect(editor.proficiencies.skillBonus('STEALTH')).toBe(0);
  });
});
