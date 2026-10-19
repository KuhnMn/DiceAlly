import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ImportComponent } from './import.component';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterSharingService } from '../characters/character-sharing.service';

describe('Old-export import controls', () => {
  it('keeps normal import separate and retains conversion mode when overriding a conflict', async () => {
    const conflict = { success: false, error: { code: 'IMPORT_CONFLICT', message: 'Already imported' } };
    const library = { changed: signal(0), error: signal(''), migrationIssues: signal([]), storageBytes: signal(0),
      summaries: vi.fn().mockResolvedValue([]), importCharacterFromJson: vi.fn().mockResolvedValue(conflict),
      importLegacyCharacterFromJson: vi.fn().mockResolvedValue(conflict) };
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: CharacterLibraryService, useValue: library }, { provide: CharacterSharingService, useValue: {} }] });
    const fixture = TestBed.createComponent(ImportComponent);
    const component = fixture.componentInstance;
    component.raw = '{"character":{"name":"Legacy"}}';
    await component.loadFromText();
    expect(library.importCharacterFromJson).toHaveBeenCalledOnce();
    expect(library.importLegacyCharacterFromJson).not.toHaveBeenCalled();
    await component.loadFromText(true);
    expect(component.pendingImport()?.legacy).toBe(true);
    await component.confirmOverride();
    expect(library.importLegacyCharacterFromJson).toHaveBeenLastCalledWith(component.raw, true);
    expect(library.importCharacterFromJson).toHaveBeenCalledOnce();
    expect(component.isConvertingLegacy()).toBe(false);
  });
});

describe('Character library loading indicators', () => {
  const character = { characterId: 'one', name: 'Test character', level: 3, description: '', lastModified: 0, size: 100, version: 1 };
  function setup(summaries = vi.fn().mockResolvedValue([character]), routes: Parameters<typeof provideRouter>[0] = []) {
    const library = { changed: signal(0), error: signal(''), migrationIssues: signal([]), storageBytes: signal(0), summaries };
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: CharacterLibraryService, useValue: library }, { provide: CharacterSharingService, useValue: {} }] });
    const fixture = TestBed.createComponent(ImportComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, library, router: TestBed.inject(Router) };
  }

  it('shows loading instead of an empty library until summaries arrive', async () => {
    let finish!: (value: typeof character[]) => void;
    const { fixture, component } = setup(vi.fn(() => new Promise<typeof character[]>(resolve => finish = resolve)));
    expect(fixture.nativeElement.textContent).toContain('Loading characters');
    expect(fixture.nativeElement.textContent).not.toContain('No saved characters');
    finish([character]); await fixture.whenStable(); fixture.detectChanges();
    expect(component.loadingCharacters()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Test character');
    expect(fixture.nativeElement.textContent).not.toContain('Loading characters');
  });

  it('keeps the newest reload pending when an older request completes', async () => {
    let finishFirst!: (value: typeof character[]) => void, finishSecond!: (value: typeof character[]) => void;
    const summaries = vi.fn().mockImplementationOnce(() => new Promise(resolve => finishFirst = resolve))
      .mockImplementationOnce(() => new Promise(resolve => finishSecond = resolve));
    const { fixture, component } = setup(summaries);
    const reload = component.reload(); finishFirst([]); await fixture.whenStable();
    expect(component.loadingCharacters()).toBe(true);
    finishSecond([character]); await reload;
    expect(component.savedCharacters()).toEqual([character]); expect(component.loadingCharacters()).toBe(false);
  });

  it('shows the opening character, blocks duplicate clicks and recovers after navigation fails', async () => {
    const { fixture, component, router, library } = setup(); await fixture.whenStable();
    let fail!: (error: Error) => void;
    const navigate = vi.spyOn(router, 'navigate').mockImplementation(() => new Promise((_resolve, reject) => fail = reject));
    const opening = component.loadCharacter('one'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Opening character');
    const load = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent!.includes('Opening'))!;
    expect(load.disabled).toBe(true); expect(load.querySelector('app-ui-icon')).not.toBeNull();
    await component.loadCharacter('two'); expect(navigate).toHaveBeenCalledOnce();
    fail(new Error('Could not open')); await opening; fixture.detectChanges();
    expect(component.openingCharacter()).toBeNull(); expect(library.error()).toContain('Could not open');
    expect(load.disabled).toBe(false);
  });

  it('tracks editor-link navigation until its route guard finishes or cancels', async () => {
    let finish!: (allowed: boolean) => void;
    const guard = new Promise<boolean>(resolve => finish = resolve);
    const { fixture, component, router } = setup(undefined, [{ path: 'characters/:id/edit', component: ImportComponent, canActivate: [() => guard] }]);
    await fixture.whenStable();
    const navigation = router.navigateByUrl('/characters/one/edit');
    await vi.waitFor(() => expect(component.openingCharacter()).not.toBeNull()); fixture.detectChanges();
    expect(component.openingCharacter()).toEqual({ id: 'one', editing: true });
    const edit = fixture.nativeElement.querySelector('a[aria-disabled="true"]');
    expect(edit.textContent).toContain('Opening');
    finish(false); await navigation; await fixture.whenStable();
    expect(component.openingCharacter()).toBeNull();
  });
});
