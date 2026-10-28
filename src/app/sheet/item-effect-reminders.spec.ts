import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { emptyBasicCharacter } from '../editor/basic-info';
import { InventoryItem } from '../models/character.model';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { ItemEffectRemindersComponent } from './item-effect-reminders.component';
import { itemEffectReminders } from './item-effect-reminders';
import { CharacterStore } from '../stores/character.store';
import { Component, inject } from '@angular/core';

@Component({
  imports: [MobileCombatPageComponent],
  template: `<app-mobile-combat-page [characterData]="store.characterData()" />`,
})
class LiveCombatHost {
  readonly store = inject(CharacterStore);
}

function magicItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    name: 'Protective Ring', source: 'XDMG', isEquipped: true, isAttuned: true,
    entity: { item: { name: 'Protective Ring', source: 'XDMG', rarity: 'rare',
      reqAttune: 'by anyone', bonusAc: '+1', bonusSavingThrow: '+1',
      entries: ['While wearing this ring, you have advantage against being {@condition Charmed|XPHB}.'] } },
    ...overrides,
  };
}

describe('Active item effect reminders', () => {
  const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  beforeAll(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
      });
    }
  });
  afterAll(() => {
    if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', modalDescriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('requires equipment and any required attunement, with no requirement for unattuned items', () => {
    for (const isEquipped of [false, true]) {
      for (const isAttuned of [false, true]) {
        for (const reqAttune of [null, undefined, '', 'false', 'by anyone', 'by a wizard']) {
          const item = magicItem({ isEquipped, isAttuned });
          item.entity!.item.reqAttune = reqAttune;
          const requiresAttunement = reqAttune === 'by anyone' || reqAttune === 'by a wizard';
          expect(itemEffectReminders([item], 'combat').length).toBe(
            isEquipped && (!requiresAttunement || isAttuned) ? 1 : 0,
          );
        }
      }
    }
    expect(itemEffectReminders([magicItem({ entity: null }), { name: 'Custom item', isEquipped: true }], 'combat')).toEqual([]);
  });

  it('only includes explicit stat bonuses and limits spell reminders to spell bonuses', () => {
    const descriptive = magicItem();
    descriptive.entity!.item = { name: 'Boots', source: 'XDMG', rarity: 'uncommon', entries: ['Your walking speed increases while wearing these boots.'] };
    const mundane = magicItem({ name: 'Rope', entity: { item: { name: 'Rope', source: 'XPHB', rarity: 'none', entries: ['A length of rope.'] } } });
    const spell = magicItem();
    Object.assign(spell.entity!.item, { bonusSpellAttack: '+2', bonusSpellSaveDc: '+2', bonusSpellDamage: '+1' });
    const inventory = [descriptive, mundane, spell];
    const before = JSON.stringify(inventory);
    expect(itemEffectReminders(inventory, 'combat')).toHaveLength(1);
    expect(itemEffectReminders(inventory, 'spells')[0].bonuses).toEqual([
      { label: 'Spell Attack', value: '+2' },
      { label: 'Spell Save DC', value: '+2' },
      { label: 'Spell Damage', value: '+1' },
    ]);
    expect(itemEffectReminders(inventory, 'combat')[0].bonuses).toContainEqual({ label: 'Saving Throws', value: '+1' });
    expect(JSON.stringify(inventory)).toBe(before);
  });

  it('skips formulas and descriptive values without guessing and normalizes numeric bonus signs', () => {
    const item = magicItem();
    Object.assign(item.entity!.item, { bonusAc: '+PB', bonusSavingThrow: '0', bonusWeapon: '2',
      bonusWeaponDamage: '{@dice 1d6}', bonusSpellAttack: '2 while holding this item', bonusSpellSaveDc: ' +1 ' });
    expect(itemEffectReminders([item], 'combat')[0].bonuses).toEqual([
      { label: 'Weapon Attack/Damage', value: '+2' },
      { label: 'Spell Save DC', value: '+1' },
    ]);
  });

  it('renders bonus cards without effect descriptions and updates when equipment changes', () => {
    const fixture = TestBed.createComponent(ItemEffectRemindersComponent);
    fixture.componentRef.setInput('sheet', { ...emptyBasicCharacter(), inventory: [magicItem()] }); fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    for (const value of ['Magic Item Bonuses', 'Protective Ring', 'AC +1', 'Saving Throws +1']) expect(text).toContain(value);
    expect(text).not.toContain('While wearing this ring');
    expect(text).not.toContain('Charmed');
    expect(fixture.nativeElement.querySelector('app-entry-renderer')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-horizontal-row]')).not.toBeNull();
    fixture.componentRef.setInput('sheet', { ...emptyBasicCharacter(), inventory: [magicItem({ isEquipped: false })] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('keeps details readable when Inventory is hidden and leaves pending source navigation untouched', () => {
    const fixture = TestBed.createComponent(ItemEffectRemindersComponent);
    const sheet = emptyBasicCharacter();
    sheet.inventory = [magicItem()];
    sheet.sheetSettings = { visiblePages: { inventory: false } };
    const store = TestBed.inject(CharacterStore);
    store.setFeatureScrollTarget('item-unrelated');
    fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('While wearing this ring');
    expect(fixture.nativeElement.querySelector('[aria-label^="Go to source for"]')).toBeNull();
    expect(store.featureScrollTarget()).toBe('item-unrelated');
    fixture.destroy();
  });

  it('uses the legacy equipment anchor for items without an editor ID', () => {
    const fixture = TestBed.createComponent(ItemEffectRemindersComponent);
    const item = magicItem();
    fixture.componentRef.setInput('sheet', { ...emptyBasicCharacter(), inventory: [item] }); fixture.detectChanges();
    const targets: string[] = [];
    fixture.componentInstance.navigateToSource.subscribe(target => targets.push(target));
    fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label^="Go to source for"]').click(); fixture.detectChanges();
    expect(targets).toEqual(['item-protective-ring-xdmg']);
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it('keeps the same dialog open when unequipping and re-equipping its item in combat', () => {
    const store = TestBed.inject(CharacterStore);
    store.setCharacter({ ...emptyBasicCharacter(), inventory: [magicItem()] });
    const fixture = TestBed.createComponent(LiveCombatHost);
    fixture.detectChanges();
    const originalOverflow = document.body.style.overflow;
    const reminder = fixture.nativeElement.querySelector('app-item-effect-reminders') as HTMLElement;
    reminder.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click(); fixture.detectChanges();
    const dialog = reminder.querySelector('dialog')!;
    const equipped = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    equipped.click(); fixture.detectChanges();
    expect(store.characterData()!.inventory![0].isEquipped).toBe(false);
    expect(reminder.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
    expect(reminder.querySelector('dialog')).toBe(dialog);
    expect(equipped.checked).toBe(false);

    equipped.click(); fixture.detectChanges();
    expect(store.characterData()!.inventory![0].isEquipped).toBe(true);
    expect(reminder.querySelector('dialog')).toBe(dialog);
    expect(equipped.checked).toBe(true);
    expect(reminder.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
    dialog.dispatchEvent(new Event('close')); fixture.detectChanges();
    expect(reminder.querySelector('dialog')).toBeNull();
    fixture.destroy();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  for (const page of [CharacterInfoPageComponent, MobileCombatPageComponent, SpellsPageComponent]) {
    it(`shows active spell bonuses on ${page.name}`, () => {
      const fixture = TestBed.createComponent<CharacterInfoPageComponent | SpellsPageComponent>(page);
      const sheet = emptyBasicCharacter();
      const item = magicItem();
      Object.assign(item.entity!.item, { bonusSpellAttack: '+2', bonusSpellSaveDc: '+2' });
      sheet.inventory = [item];
      fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
      const reminder = fixture.nativeElement.querySelector('app-item-effect-reminders');
      const text = reminder?.textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Spell Attack +2');
      expect(text).toContain('Spell Save DC +2');
      fixture.componentRef.setInput('characterData', { ...sheet, inventory: [magicItem({ isAttuned: false })] }); fixture.detectChanges();
      expect(reminder.querySelector('section')).toBeNull();
    });

    it(`opens the item details in place and goes to the exact source on ${page.name}`, () => {
      const fixture = TestBed.createComponent<CharacterInfoPageComponent | SpellsPageComponent>(page);
      const sheet = emptyBasicCharacter();
      const item = magicItem({ editorId: 'second-ring' });
      item.entity!.item.bonusSpellAttack = '+2';
      sheet.inventory = [magicItem({ editorId: 'first-ring' }), item];
      const before = JSON.stringify(sheet);
      fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
      const targets: string[] = [];
      const component = fixture.componentInstance;
      const navigation = component instanceof SpellsPageComponent ? component.navigateToSource : component.navigateToFeatures;
      navigation.subscribe(target => targets.push(target));
      const cards = fixture.nativeElement.querySelectorAll('app-item-effect-reminders button[aria-haspopup="dialog"]');
      const card = cards[cards.length - 1] as HTMLButtonElement;
      card.click(); fixture.detectChanges();
      expect(card.getAttribute('aria-expanded')).toBe('true');
      expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('While wearing this ring');
      expect(targets).toEqual([]);
      fixture.nativeElement.querySelector('dialog').dispatchEvent(new Event('close')); fixture.detectChanges();
      expect(card.getAttribute('aria-expanded')).toBe('false');
      expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
      card.click(); fixture.detectChanges();
      fixture.nativeElement.querySelector('[aria-label="Go to source for Protective Ring"]').click(); fixture.detectChanges();
      expect(targets).toEqual(['item-second-ring']);
      expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
      expect(JSON.stringify(sheet)).toBe(before);
      fixture.destroy();
    });
  }
});
