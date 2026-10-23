import { ConcentrationService } from '../services/concentration.service';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileSheetStatusComponent } from './mobile-sheet-status.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { SpellsEditorComponent } from '../editor/spells-editor.component';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { emptyBasicCharacter } from '../editor/basic-info';
import { prefillCombatAction, combatSourceChanged } from '../editor/combat-actions';
import { CharacterHelpersService } from './character-helpers.service';
import { CombatEditorComponent } from '../editor/combat-editor.component';
import { ConcentrationControlComponent } from './concentration-control.component';
import { CharacterStore } from '../stores/character.store';
import { AppDialogService } from '../services/app-dialog.service';
import { RestService } from '../services/rest.service';

describe('Usability state protection', () => {
  it('detects changed weapon bonuses and refreshes while retaining custom text and identity', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.abilityScores = { strength: 14 };
    const weapon = { editorId: 'weapon', name: 'Sword', entity: { item: { name: 'Sword', source: 'TEST', dmg1: '1d8', dmgType: 'S' } } };
    sheet.inventory = [weapon];
    const helpers = TestBed.inject(CharacterHelpersService);
    const action = prefillCombatAction(sheet, weapon, 'ITEM', helpers);
    action.damageOrHeal = 'Custom damage for this campaign';
    sheet.combatActions = [action];
    expect(combatSourceChanged(sheet, action, helpers)).toBe(false);
    sheet.character!.abilityScores!.strength = 18;
    expect(combatSourceChanged(sheet, action, helpers)).toBe(true);
    const fixture = TestBed.createComponent(CombatEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges();
    const review = fixture.componentInstance;
    const id = action.editorId;
    review.update(action);
    expect(review.draft?.damageOrHeal).toBe('Custom damage for this campaign');
    expect(review.draft?.hitOrDc).toBe('+6 to hit');
    review.save(review.draft!);
    expect(action.hitOrDc).toBe('+6 to hit');
    expect(action.damageOrHeal).toBe('Custom damage for this campaign');
    expect(action.editorId).toBe(id);
    expect(combatSourceChanged(sheet, action, helpers)).toBe(false);
  });

  it('does not preselect replacement fields on old bookmarks without a baseline', () => {
    const sheet = emptyBasicCharacter();
    const resource = { editorId: 'item', name: 'Item' };
    sheet.inventory = [resource];
    const action = prefillCombatAction(sheet, resource, 'ITEM', TestBed.inject(CharacterHelpersService));
    delete action.sourceSnapshot;
    const fixture = TestBed.createComponent(CombatEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges();
    fixture.componentInstance.update(action);
    for (const key of ['name', 'range', 'hitOrDc', 'damageOrHeal', 'actionType'] as const) expect(fixture.componentInstance.draft?.[key]).toBe(action[key]);
  });

  it('tracks a custom concentration effect, reminds after damage, and ends manually', async () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.currentHp = 20; sheet.character!.tempHp = 10;
    const store = TestBed.inject(CharacterStore); store.setCharacter(sheet);
    const fixture = TestBed.createComponent(ConcentrationControlComponent);
    fixture.componentRef.setInput('sheet', store.characterData()); fixture.detectChanges();
    const control = fixture.componentInstance;
    control.effectName = 'Custom effect'; await control.start();
    fixture.componentRef.setInput('sheet', store.characterData()); fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('button[aria-label="Concentrating: Custom effect"]');
    expect(icon.getAttribute('aria-pressed')).toBe('true');
    icon.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=dialog]').textContent).toContain('Custom effect');
    expect(store.characterData()!.character!.concentrationEffect).toBe('Custom effect');
    const confirm = vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(false);
    control.effectName = 'Replacement'; await control.start();
    expect(confirm).toHaveBeenCalledOnce();
    expect(store.characterData()!.character!.concentrationEffect).toBe('Custom effect');
    control.setEffect('');
    expect(store.characterData()!.character!.concentrationEffect).toBe('');
  });

  it.each(['desktop', 'mobile'])('shows the reminder after %s damage and supports both choices', async layout => {
    const sheet = emptyBasicCharacter();
    Object.assign(sheet.character!, { maxHp: 20, currentHp: 20, tempHp: 10, concentrationEffect: 'Entangle' });
    const store = TestBed.inject(CharacterStore); store.setCharacter(sheet);
    const dialogs = TestBed.inject(AppDialogService);
    const fixture = layout === 'desktop' ? TestBed.createComponent(CharacterInfoPageComponent) : TestBed.createComponent(MobileSheetStatusComponent);
    fixture.componentRef.setInput(layout === 'desktop' ? 'characterData' : 'sheet', sheet); fixture.detectChanges();
    const damage = () => {
      if (layout === 'desktop') {
        const page = fixture.componentInstance as CharacterInfoPageComponent;
        page.hpAdjustmentInput.set('3'); page.applyDamageFromAdjustment();
      } else {
        const page = fixture.componentInstance as MobileSheetStatusComponent;
        page.amount.set('3'); page.adjust('damage');
      }
    };
    damage();
    expect(store.characterData()!.character!.currentHp).toBe(20);
    expect(dialogs.current()?.title).toBe('Concentration Reminder');
    expect(dialogs.current()?.confirmLabel).toBe('Okay');
    expect(dialogs.current()?.secondaryLabel).toBe('End Concentration');
    dialogs.finish(true); await Promise.resolve();
    expect(store.characterData()!.character!.concentrationEffect).toBe('Entangle');
    damage(); dialogs.finish(false); await Promise.resolve();
    expect(store.characterData()!.character!.concentrationEffect).toBe('');
  });

  it('respects the per-character reminder toggle and ignores healing or invalid damage', async () => {
    const store = TestBed.inject(CharacterStore);
    const sheet = emptyBasicCharacter();
    Object.assign(sheet.character!, { concentrationEffect: 'Entangle', concentrationReminderEnabled: false });
    store.setCharacter(sheet);
    const service = TestBed.inject(ConcentrationService);
    const dialogs = TestBed.inject(AppDialogService);
    await service.remindAfterDamage(sheet, 5);
    expect(dialogs.current()).toBeNull();
    sheet.character!.concentrationReminderEnabled = true;
    for (const amount of [0, -1, NaN]) await service.remindAfterDamage(sheet, amount);
    expect(dialogs.current()).toBeNull();
    const pending = service.remindAfterDamage(sheet, 5);
    store.setCharacter({ ...sheet, character: { ...sheet.character, concentrationEffect: 'Replacement' } });
    dialogs.finish(false); await pending;
    expect(store.characterData()!.character!.concentrationEffect).toBe('Replacement');
  });

  it.each([CharacterInfoPageComponent, MobileCombatPageComponent])('places the concentration icon beside the round input in %s', component => {
    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('characterData', emptyBasicCharacter()); fixture.detectChanges();
    const round = fixture.nativeElement.querySelector('input[aria-label="Round tracker value"]');
    const row = round.closest('[aria-label="Concentration & Round Tracker"]');
    expect(row.querySelector('button[aria-label="Track concentration"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-combat-source-review')).toBeNull();
  });

  it('offers a default-on reminder setting in the creator Spells tab and updates the character', async () => {
    const fixture = TestBed.createComponent(SpellsEditorComponent);
    const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const toggle = fixture.nativeElement.querySelector('input[name="concentration-reminder"]') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    toggle.click(); await fixture.whenStable();
    expect(sheet.character!.concentrationReminderEnabled).toBe(false);
    toggle.click(); await fixture.whenStable();
    expect(sheet.character!.concentrationReminderEnabled).toBe(true);
  });

  it('does not mutate health, dice, or uses while previewing a rest', () => {
    const sheet = emptyBasicCharacter();
    Object.assign(sheet.character!, { currentHp: 3, maxHp: 20, hitDice: [{ dieType: 'd8', total: 4, used: 3 }] });
    sheet.features = [{ name: 'Ability', uses: [{ totalFreeUses: 2, usedFreeUses: 2, freeUsesRegainCondition: 'LONG_REST' }] }];
    const before = structuredClone(sheet);
    const rest = TestBed.inject(RestService);
    expect(rest.previewRest(sheet, 'long')).toContain('HP: 17 restored');
    expect(sheet).toEqual(before);
    expect(rest.report()).toBeNull();
  });
});
