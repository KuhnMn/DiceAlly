import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CharacterSheetComponent } from './character-sheet.component';
import { SheetLayoutService, sheetColumnCapacity } from './sheet-layout.service';
import { CharacterStore } from '../stores/character.store';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterSessionService } from '../characters/character-session.service';
import { emptyBasicCharacter } from '../editor/basic-info';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { NotesPageComponent } from './notes-page.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';

function setup() {
  const mode = signal<'phone' | 'tablet' | 'desktop'>('phone');
  TestBed.configureTestingModule({ providers: [provideRouter([]),
    { provide: SheetLayoutService, useValue: { mode, compact: computed(() => mode() !== 'desktop'), shortTablet: signal(false), wideTablet: signal(false), contentColumns: signal(1) } },
    { provide: CharacterLibraryService, useValue: { changed: signal(0) } },
    { provide: CharacterSessionService, useValue: { loadedVersion: signal(0) } },
  ] });
  const store = TestBed.inject(CharacterStore), sheet = emptyBasicCharacter();
  sheet.character!.name = 'Tablet test'; sheet.character!.maxHp = 30; sheet.character!.currentHp = 20;
  sheet.basicActions = [{ name: 'Attack', source: 'XPHB', entries: ['Attack.'], actionTypes: ['ACTION'] }];
  store.setCharacter(sheet); store.nativeCharacterId.set(sheet.character!.characterUuid!); store.nativeSave = vi.fn(async () => {});
  const fixture = TestBed.createComponent(CharacterSheetComponent); fixture.detectChanges();
  return { mode, fixture, component: fixture.componentInstance, store };
}

describe('Sheet layouts preserve navigation and character state', () => {
  it('keeps Combat single-column until selected and retains its choice across navigation and resizing', () => {
    const { mode, fixture, component } = setup();
    component.switchPage(7, false); fixture.detectChanges();
    const combat = fixture.debugElement.query(By.directive(MobileCombatPageComponent));
    const selector = combat.query(By.directive(SheetListLayoutComponent));
    const layout = selector.componentInstance as SheetListLayoutComponent;
    const groups = combat.nativeElement.querySelector('.combat-groups') as HTMLElement;
    for (const size of ['tablet', 'desktop'] as const) {
      mode.set(size); fixture.detectChanges();
      expect(layout.displayColumns()).toBe(1);
      expect(groups.classList.contains('combat-multiple-columns')).toBe(false);
    }
    const buttons = selector.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click(); fixture.detectChanges();
    expect(groups.classList.contains('combat-multiple-columns')).toBe(true);
    expect(groups.style.getPropertyValue('--combat-columns')).toBe('2');
    buttons[2].click(); fixture.detectChanges();
    expect(groups.style.getPropertyValue('--combat-columns')).toBe('3');
    component.switchPage(1, false); fixture.detectChanges();
    component.switchPage(7, false); fixture.detectChanges();
    expect(layout.columns()).toBe(3);
    mode.set('phone'); layout.maxColumns.set(1); fixture.detectChanges();
    expect(groups.classList.contains('combat-multiple-columns')).toBe(false);
    expect(layout.columns()).toBe(3);
    mode.set('tablet'); layout.maxColumns.set(2); fixture.detectChanges();
    expect(groups.style.getPropertyValue('--combat-columns')).toBe('2');
    expect(buttons[2].disabled).toBe(true);
    fixture.destroy();
  });

  it('keeps Combat and its expanded groups across phone, tablet and desktop sizes', () => {
    const { mode, fixture, component, store } = setup();
    component.switchPage(7, false); fixture.detectChanges();
    const combat = fixture.debugElement.query(By.directive(MobileCombatPageComponent)).componentInstance;
    const group = fixture.nativeElement.querySelector('app-mobile-combat-page details') as HTMLDetailsElement;
    group.open = true;
    store.characterData()!.character!.currentHp = 7;
    const before = structuredClone(store.characterData());
    for (const size of ['tablet', 'desktop', 'tablet', 'phone'] as const) {
      mode.set(size); fixture.detectChanges();
      expect(component.pages().map(page => page.id)).toEqual([1, 7, 2, 3, 4, 5, 8, 6]);
      expect(component.currentPage()).toBe(7);
      expect(fixture.debugElement.query(By.directive(MobileCombatPageComponent)).componentInstance).toBe(combat);
      expect(group.open).toBe(true);
      expect(store.characterData()).toEqual(before);
    }
  });

  it('retains overview disclosure state and mounted spell filters and note drafts through layout switches', () => {
    const { mode, fixture, component, store } = setup();
    const overview = fixture.debugElement.query(By.directive(MobileCharacterInfoPageComponent)).componentInstance;
    const disclosure = fixture.nativeElement.querySelector('app-mobile-character-info-page details') as HTMLDetailsElement;
    disclosure.open = false;
    component.switchPage(3, false); fixture.detectChanges();
    const spells = fixture.debugElement.query(By.directive(SpellsPageComponent)).componentInstance as SpellsPageComponent;
    spells.spellRitualFilter.set('RITUAL');
    component.switchPage(6, false); fixture.detectChanges();
    const notes = fixture.debugElement.query(By.directive(NotesPageComponent)).componentInstance;
    store.noteDraft.set({ id: 42, title: 'Unsaved', body: 'Keep this draft' });
    for (const size of ['tablet', 'desktop', 'phone'] as const) { mode.set(size); fixture.detectChanges(); }
    expect(component.currentPage()).toBe(6);
    expect(fixture.debugElement.query(By.directive(NotesPageComponent)).componentInstance).toBe(notes);
    expect(store.noteDraft()?.body).toBe('Keep this draft');
    expect(fixture.debugElement.query(By.directive(SpellsPageComponent)).componentInstance).toBe(spells);
    expect(spells.spellRitualFilter()).toBe('RITUAL');
    expect(fixture.debugElement.query(By.directive(MobileCharacterInfoPageComponent)).componentInstance).toBe(overview);
    expect(disclosure.open).toBe(false);
  });

  it('caps visible list columns by available space without overwriting the selection', () => {
    expect([655, 656, 991, 992].map(sheetColumnCapacity)).toEqual([1, 2, 2, 3]);
    const fixture = TestBed.createComponent(SheetListLayoutComponent);
    const layout = fixture.componentInstance;
    layout.columns.set(3); layout.maxColumns.set(2); fixture.detectChanges();
    expect(layout.displayColumns()).toBe(2);
    expect(layout.columns()).toBe(3);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[2].disabled).toBe(true); expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    layout.maxColumns.set(3); expect(layout.displayColumns()).toBe(3);
  });
});
