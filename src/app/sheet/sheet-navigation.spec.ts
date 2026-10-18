import { AppDialogService } from '../services/app-dialog.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CharacterSheetComponent } from './character-sheet.component';
import { SpellsPageComponent } from './spells-page.component';
import { MobileSheetStatusComponent } from './mobile-sheet-status.component';
import { CharacterStore } from '../stores/character.store';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterSessionService } from '../characters/character-session.service';
import { emptyBasicCharacter } from '../editor/basic-info';

describe('Sheet navigation and mobile health integration', () => {
  it('keeps rest changes unsaved until an explicit save', async () => {
    const { component, store } = setup(true);
    store.nativeCharacterId.set(store.characterData()!.character!.characterUuid!);
    vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(true);
    await component.performShortRest();
    expect(store.nativeSave).not.toHaveBeenCalled();
    await component.performLongRest();
    expect(store.characterData()?.character?.currentHp).toBe(30);
    expect(component.hasUnsavedChanges()).toBe(true);
    expect(store.nativeSave).not.toHaveBeenCalled();
    await component.onCharacterRested('long');
    expect(store.nativeSave).not.toHaveBeenCalled();
    await component.quickSave();
    expect(store.nativeSave).toHaveBeenCalledOnce();
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('previews rest without changing data and cancels safely', async () => {
    const { component, store } = setup(true);
    const before = structuredClone(store.characterData());
    const confirm = vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(false);
    await component.performLongRest();
    expect(confirm.mock.calls[0][0]).toContain('restore all spent Hit Dice');
    expect(confirm.mock.calls[0][0]).toContain('HP: 10 restored');
    expect(store.characterData()).toEqual(before);
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('saves an open note draft and protects it before saving', async () => {
    const { component, store } = setup(true);
    store.noteDraft.set({ id: 1, title: 'Session', body: 'Keep this draft' });
    expect(component.hasUnsavedChanges()).toBe(true);
    await component.quickSave();
    expect(store.nativeSave).toHaveBeenCalledWith(expect.objectContaining({ notes: [expect.objectContaining({ body: 'Keep this draft' })] }));
    expect(store.noteDraft()).toBeNull();
    expect(component.hasUnsavedChanges()).toBe(false);
  });
  function setup(mobile = false) {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: CharacterLibraryService, useValue: { changed: signal(0) } },
      { provide: CharacterSessionService, useValue: { loadedVersion: signal(0) } },
    ] });
    const store = TestBed.inject(CharacterStore);
    const sheet = emptyBasicCharacter();
    sheet.character!.currentHp = 20;
    sheet.character!.maxHp = 30;
    store.setCharacter(sheet);
    store.nativeCharacterId.set(sheet.character!.characterUuid!);
    store.nativeSave = vi.fn(async () => {});
    const fixture = TestBed.createComponent(CharacterSheetComponent);
    vi.spyOn(fixture.componentInstance, 'mobile').mockReturnValue(mobile);
    fixture.detectChanges();
    return { fixture, sheet, store, component: fixture.componentInstance };
  }

  it('retains the mounted page and its filters and rejects navigation past either end', () => {
    const { fixture, component } = setup();
    component.switchPage(3, false); fixture.detectChanges();
    const spells = fixture.debugElement.query(By.directive(SpellsPageComponent)).componentInstance as SpellsPageComponent;
    spells.spellRitualFilter.set('RITUAL');
    component.switchPage(6, false); fixture.detectChanges();
    component.switchPage(7, false);
    expect(component.currentPage()).toBe(6);
    component.switchPage(3, false); fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(SpellsPageComponent)).componentInstance).toBe(spells);
    expect(spells.spellRitualFilter()).toBe('RITUAL');
    component.switchPage(1, false); component.switchPage(0, false);
    expect(component.currentPage()).toBe(1);
  });

  it('starts desktop tabs at the page top on both first visits and return visits', () => {
    const { fixture, component } = setup();
    let frame: FrameRequestCallback = () => {};
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(250);
    for (const page of [2, 3, 4, 2]) {
      component.switchPage(page); fixture.detectChanges(); frame(0);
      expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    }
  });

  it('marks mobile health edits as unsaved and persists the same data through Quick Save', async () => {
    const { fixture, component, store, sheet } = setup();
    const status = fixture.debugElement.query(By.directive(MobileSheetStatusComponent)).componentInstance as MobileSheetStatusComponent;
    expect(component.hasUnsavedChanges()).toBe(false);
    status.amount.set('8');
    const damage = [...fixture.nativeElement.querySelectorAll('app-mobile-sheet-status button')].find((button: any) => button.textContent.trim() === 'Damage') as HTMLButtonElement;
    damage.click(); fixture.detectChanges();
    expect(sheet.character!.currentHp).toBe(12);
    expect(component.hasUnsavedChanges()).toBe(true);
    const desktopSave = fixture.nativeElement.querySelector('main > div.hidden button') as HTMLButtonElement;
    expect(desktopSave.textContent).toContain('Save changes');
    await component.quickSave();
    fixture.detectChanges();
    expect(store.nativeSave).toHaveBeenCalledWith(expect.objectContaining({ character: expect.objectContaining({ currentHp: 12 }) }));
    expect(component.hasUnsavedChanges()).toBe(false);
    expect(desktopSave.textContent).toContain('Saved');
    status.amount.set('1'); damage.click(); fixture.detectChanges();
    expect(desktopSave.textContent).toContain('Save changes');
  });

  it('places mobile Combat between Sheet and Features and follows that order when swiping', () => {
    const { fixture, component } = setup(true);
    fixture.detectChanges();
    expect(component.pages.slice(0, 3).map(page => page.label)).toEqual(['Sheet', 'Combat', 'Features']);
    expect(fixture.nativeElement.querySelector('app-mobile-character-header section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-mobile-character-info-page')?.textContent).not.toContain('Combat');
    component.swipePage(1); fixture.detectChanges();
    expect(component.currentPage()).toBe(7);
    expect(fixture.nativeElement.querySelector('app-mobile-combat-page')).not.toBeNull();
    component.swipePage(1); fixture.detectChanges();
    expect(component.currentPage()).toBe(2);
    component.swipePage(-1); fixture.detectChanges();
    expect(component.currentPage()).toBe(7);
    component.switchPage(1, false); component.swipePage(-1);
    expect(component.currentPage()).toBe(1);
  });
});
