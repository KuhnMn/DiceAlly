import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { emptyBasicCharacter } from '../editor/basic-info';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { BastionsPageComponent } from './bastions-page.component';

const key = (id: string, page = 'spells') => `dice-ally-sheet-columns-${JSON.stringify([id, page])}`;

describe('Remembered character list columns', () => {
  beforeEach(() => {
    for (const id of ['layout-a', 'layout-b']) {
      for (const page of ['spells', 'features']) localStorage.removeItem(key(id, page));
    }
  });
  afterEach(() => vi.restoreAllMocks());

  function setup(id: string | undefined = 'layout-a', page = 'spells') {
    const fixture = TestBed.createComponent(SheetListLayoutComponent);
    fixture.componentRef.setInput('characterId', id);
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    const choose = (columns: number) => {
      fixture.nativeElement.querySelectorAll('button')[columns - 1].click();
      fixture.detectChanges();
    };
    return { fixture, layout: fixture.componentInstance, choose };
  }

  it.each([
    [FeaturesPageComponent, 'features'], [SpellsPageComponent, 'spells'],
    [MobileCombatPageComponent, 'combat'], [EquipmentPageComponent, 'inventory'],
    [MonstersPageComponent, 'companions'], [BastionsPageComponent, 'bastions'],
  ] as const)('restores the page choice after reopening %s without changing the character', (component, page) => {
    const sheet = emptyBasicCharacter(), other = emptyBasicCharacter();
    const before = structuredClone(sheet);
    const open = () => {
      const fixture = TestBed.createComponent<FeaturesPageComponent | SpellsPageComponent | MobileCombatPageComponent | EquipmentPageComponent | MonstersPageComponent | BastionsPageComponent>(component);
      fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
      const selector = fixture.debugElement.query(By.directive(SheetListLayoutComponent));
      return { fixture, selector, layout: selector.componentInstance as SheetListLayoutComponent };
    };
    const first = open();
    first.selector.nativeElement.querySelectorAll('button')[1].click(); first.fixture.detectChanges();
    first.fixture.destroy();
    const reopened = open();
    expect(reopened.layout.columns()).toBe(2);
    reopened.fixture.componentRef.setInput('characterData', other); reopened.fixture.detectChanges();
    expect(reopened.layout.columns()).toBe(1);
    reopened.fixture.componentRef.setInput('characterData', sheet); reopened.fixture.detectChanges();
    expect(reopened.layout.columns()).toBe(2);
    expect(sheet).toEqual(before);
    reopened.fixture.destroy();
    localStorage.removeItem(key(sheet.character!.characterUuid!, page));
  });

  it('keeps separate choices for both pages and resets them when changing character', () => {
    const { fixture, layout, choose } = setup();
    choose(3);
    fixture.componentRef.setInput('page', 'features'); fixture.detectChanges();
    expect(layout.columns()).toBe(1); choose(2);
    fixture.componentRef.setInput('page', 'spells'); fixture.detectChanges();
    expect(layout.columns()).toBe(3);
    fixture.componentRef.setInput('characterId', 'layout-b'); fixture.detectChanges();
    expect(layout.columns()).toBe(1); choose(2);
    fixture.componentRef.setInput('characterId', 'layout-a'); fixture.detectChanges();
    expect(layout.columns()).toBe(3);
    fixture.componentRef.setInput('characterId', undefined); fixture.detectChanges();
    expect(layout.columns()).toBe(1);
  });

  it('keeps the saved preference when the viewport only supports fewer columns', () => {
    const { fixture, layout, choose } = setup(); choose(3);
    for (const capacity of [1, 2, 3]) {
      layout.maxColumns.set(capacity); fixture.detectChanges();
      expect(layout.displayColumns()).toBe(capacity);
      expect(layout.columns()).toBe(3);
      expect(localStorage.getItem(key('layout-a'))).toBe('3');
    }
    fixture.destroy();
    expect(setup().layout.columns()).toBe(3);
  });

  it('ignores invalid stored choices and works when storage cannot be read or written', () => {
    for (const value of ['0', '4', '-1', '2.5', 'null', '{}']) {
      localStorage.setItem(key('layout-a'), value);
      const { fixture, layout } = setup();
      expect(layout.columns()).toBe(1); fixture.destroy();
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    const { layout, choose } = setup();
    expect(layout.columns()).toBe(1);
    choose(2); expect(layout.columns()).toBe(2);
  });
});
