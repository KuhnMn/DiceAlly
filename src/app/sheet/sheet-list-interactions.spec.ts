import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { ConditionsComponent } from './conditions.component';
import { MobileSheetActionsComponent } from './mobile-sheet-actions.component';
import { InventoryItem, Monster } from '../models/character.model';
import { ThemePickerComponent } from '../theme-picker.component';
import { ThemeService } from '../services/theme.service';
import { signal } from '@angular/core';
import { CharacterStore } from '../stores/character.store';

describe('Sheet inventory interactions', () => {
  function setup() {
    const items: InventoryItem[] = [
      { editorId: 'potion', name: 'Potion', allowMultiples: true, count: 3 },
      { editorId: 'sword', name: 'Sword', isEquipped: true, isAttuned: true, entity: { item: { name: 'Sword', source: 'TEST', reqAttune: 'Yes' }, properties: [{ name: 'Versatile', entry: { text: 'Use either damage die.' } }] } },
    ];
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, inventory: items });
    fixture.detectChanges();
    return { fixture, items, component: fixture.componentInstance };
  }

  it('preserves saved inventory order when equipment states change', () => {
    const { items, component } = setup();
    expect(component.visibleInventory().map(item => item.name)).toEqual(['Potion', 'Sword']);
    component.toggleEquipped(items[0]);
    expect(component.visibleInventory().map(item => item.name)).toEqual(['Potion', 'Sword']);
    component.toggleEquipped(items[1]);
    expect(component.visibleInventory().map(item => item.name)).toEqual(['Potion', 'Sword']);
    expect(items.map(item => item.name)).toEqual(['Potion', 'Sword']);
  });

  it('adjusts quantity with the stepper and prevents decrementing below zero', () => {
    const { fixture, items } = setup();
    const decrease = fixture.nativeElement.querySelector('button[aria-label="Decrease quantity of Potion"]') as HTMLButtonElement;
    const increase = fixture.nativeElement.querySelector('button[aria-label="Increase quantity of Potion"]') as HTMLButtonElement;
    increase.click(); fixture.detectChanges();
    expect(items[0].count).toBe(4);
    for (let index = 0; index < 4; index++) { decrease.click(); fixture.detectChanges(); }
    expect(items[0].count).toBe(0);
    expect(decrease.disabled).toBe(true);
    increase.click(); fixture.detectChanges();
    expect(items[0].count).toBe(1);
    expect(decrease.disabled).toBe(false);
  });

  it('preserves attunement when unequipping and offers a separate end action', () => {
    const { fixture, items, component } = setup();
    component.inventoryFilter.set('attuned'); fixture.detectChanges();
    expect(component.visibleInventory().length).toBe(1);
    const equipped = fixture.nativeElement.querySelector('button[aria-label="Unequip Sword"]') as HTMLButtonElement;
    equipped.click(); fixture.detectChanges();
    expect(items[1].isEquipped).toBe(false);
    expect(items[1].isAttuned).toBe(true);
    expect(component.attunedCount).toBe(1);
    expect(component.visibleInventory()).toEqual([items[1]]);
    (fixture.nativeElement.querySelector('button[aria-label="Unattune Sword"]') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(items[1].isAttuned).toBe(false);
    expect(component.attunedCount).toBe(0);
    expect(component.visibleInventory()).toEqual([]);
  });

  it('fills equipment icons when active and offers attunement independently of equipment', () => {
    const { fixture, component } = setup();
    const icon = (action: string) => fixture.nativeElement.querySelector(`button[aria-label="${action} Sword"]`);
    expect(icon('Unequip').querySelector('svg').getAttribute('fill')).toBe('currentColor');
    expect(icon('Unattune').querySelector('svg').getAttribute('fill')).toBe('currentColor');
    icon('Unattune').click(); fixture.detectChanges();
    expect(icon('Attune').querySelector('svg').getAttribute('fill')).toBe('none');
    icon('Unequip').click(); fixture.detectChanges();
    expect(icon('Equip').querySelector('svg').getAttribute('fill')).toBe('none');
    expect(icon('Attune')).not.toBeNull();
    expect(component.expandedItems().size).toBe(0);
    icon('Equip').click(); fixture.detectChanges();
    expect(icon('Attune')).not.toBeNull();
  });

  it('keeps properties and deletion accessible after expansion without nested buttons', async () => {
    const { fixture, items, component } = setup();
    fixture.nativeElement.querySelector('#item-sword h3 button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button button')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-rule-details details')?.textContent).toContain('Use either damage die.');
    expect(fixture.nativeElement.querySelector('dialog button[aria-label="Delete Sword"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('dialog').textContent).not.toContain('Item actions');
    const confirm = vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(true);
    await component.deleteItem(items[1]); fixture.detectChanges();
    expect(confirm).toHaveBeenCalledOnce();
    expect(items.map(item => item.name)).toEqual(['Potion']);
  });

  it('deletes from the card trash button only after confirmation', async () => {
    const { fixture, items } = setup();
    const confirm = vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    fixture.nativeElement.querySelector('button[aria-label="Delete Sword"]').click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(items.length).toBe(2);
    fixture.nativeElement.querySelector('button[aria-label="Delete Sword"]').click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(items.map(item => item.name)).toEqual(['Potion']);
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it('closes item details before confirmation and restores them when deletion is cancelled', async () => {
    const { fixture, items, component } = setup();
    component.toggleExpanded(component.itemKey(items[1])); fixture.detectChanges();
    vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockImplementation(async () => {
      expect(component.expandedItems().size).toBe(0);
      return false;
    });
    await component.deleteItem(items[1]); fixture.detectChanges();
    expect(component.isExpanded(component.itemKey(items[1]))).toBe(true);
    expect(fixture.nativeElement.querySelector('dialog h2').textContent).toBe('Sword');
    expect(items.length).toBe(2);
  });
});

describe('Companion list presentation', () => {
  it('sorts a copy, filters tracked companions, and gives same-name creatures independent expansion', () => {
    const monsters: Monster[] = [
      { editorId: 'reference', name: 'Wolf', hpEnabled: false, entity: { cr: '1/4', hp: { average: 11 } } },
      { editorId: 'companion', name: 'Wolf', hpEnabled: true, monsterCurrentHP: 12, entity: { hp: { average: 20 }, ac: [13] } },
    ];
    Object.freeze(monsters);
    const fixture = TestBed.createComponent(MonstersPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, monsters }); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.monsters()[0].editorId).toBe('companion');
    expect(monsters[0].editorId).toBe('reference');
    expect(component.getEffectiveMonsterMaxHP(monsters[1])).toBe(20);
    fixture.nativeElement.querySelector('article h3 button').click(); fixture.detectChanges();
    expect(component.isExpanded('monster-companion')).toBe(true);
    expect(component.isExpanded('monster-reference')).toBe(false);
    component.monsterFilter.set('reference'); fixture.detectChanges();
    expect(component.visibleMonsters().map(monster => monster.editorId)).toEqual(['reference']);
  });
});

describe('Spell controls', () => {
  it('shows the prepared state and switches back to Prepare after confirming unprepare', async () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [
      { editorId: 'known', name: 'Light', listType: 'KNOWN' },
      { editorId: 'prepared', name: 'Light', listType: 'PREPARED' },
    ] });
    fixture.componentInstance.spellListTypeFilter.set('KNOWN'); fixture.detectChanges();
    const unprepare = fixture.nativeElement.querySelector('button[aria-label="Unprepare Light"]') as HTMLButtonElement;
    expect(unprepare.querySelector('svg')).not.toBeNull();
    expect(unprepare.textContent).toContain('Prep.');
    expect(unprepare.getAttribute('aria-pressed')).toBe('true');
    unprepare.click();
    TestBed.inject(AppDialogService).finish(true);
    await fixture.whenStable();
    const saved = TestBed.inject(CharacterStore).characterData();
    expect(saved?.spells?.map(spell => spell.listType)).toEqual(['KNOWN']);
    fixture.componentRef.setInput('characterData', saved); fixture.detectChanges();
    const prepare = fixture.nativeElement.querySelector('button[aria-label="Prepare Light"]') as HTMLButtonElement;
    expect(prepare.querySelector('svg')).not.toBeNull();
    expect(prepare.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks tracked spells as locked without offering an unprepare action', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [
      { editorId: 'tracked', name: 'Light', listType: 'PREPARED', uses: [{ totalFreeUses: 1, usedFreeUses: 0 }] },
    ] });
    fixture.detectChanges();
    const locked = fixture.nativeElement.querySelector('button[aria-label*="cannot be unprepared"]') as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.querySelector('svg')).not.toBeNull();
    expect(locked.textContent).not.toContain('Unprepare');
  });

  it('prepares independently of expansion and retains the summary when collapsed', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [{ editorId: 'light', name: 'Light', listType: 'KNOWN', entity: { name: 'Light', level: 0, meta: { ritual: true }, time: [{ number: 1, unit: 'action' }], duration: [{ type: 'timed', duration: { amount: 10, type: 'minute' }, concentration: true }] } }] });
    fixture.componentInstance.spellListTypeFilter.set('KNOWN'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button button')).toBeNull();
    fixture.nativeElement.querySelector('button[aria-label="Prepare Light"]').click(); fixture.detectChanges();
    expect(fixture.componentInstance.expandedItems().size).toBe(0);
    const concentration = fixture.nativeElement.querySelector('span[aria-label="Concentration"]');
    expect(concentration.textContent).toBe('C');
    expect(concentration.previousElementSibling.textContent).toBe('Ritual');
    expect(fixture.nativeElement.querySelector('app-spell-summary')?.textContent).toContain('10 minutes');
    expect(fixture.nativeElement.querySelector('app-spell-summary')?.textContent).not.toContain('minutes C');
  });
});

describe('Inline condition picker and action menus', () => {
  it('offers standard and custom conditions with explicit accessible actions', () => {
    const fixture = TestBed.createComponent(ConditionsComponent);
    fixture.componentRef.setInput('activeConditions', []); fixture.detectChanges();
    const changes: string[][] = [];
    fixture.componentInstance.conditionsChanged.subscribe(value => changes.push(value));
    fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Available conditions"]')).not.toBeNull();
    fixture.componentInstance.customConditionInput.set('Blessed');
    fixture.componentInstance.addCustomCondition(); fixture.detectChanges();
    expect(changes).toEqual([['Blessed']]);
    expect(fixture.componentInstance.showDropdown()).toBe(false);
  });

  it('dismisses mobile menus on outside interaction and Escape', () => {
    const fixture = TestBed.createComponent(MobileSheetActionsComponent); fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    menu.open = true;
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.open).toBe(false);
    menu.open = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.open).toBe(false);
  });
});

describe('Theme picker initial selection', () => {
  it('reflects a saved theme when the options first render and when it changes externally', () => {
    const currentTheme = signal('dark-mc');
    TestBed.configureTestingModule({ providers: [{ provide: ThemeService, useValue: {
      currentTheme, availableThemes: ['light-mc', 'dark-mc'], setTheme: vi.fn(),
    } }] });
    const fixture = TestBed.createComponent(ThemePickerComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').value).toBe('dark-mc');
    currentTheme.set('light-mc'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').value).toBe('light-mc');
  });
});
import { AppDialogService } from '../services/app-dialog.service';
