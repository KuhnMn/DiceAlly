import { ContentImportComponent } from './content/content-import.component';
import { IndexedDbContentCache } from './content/content-cache';
import { DEFAULT_CONTENT_SOURCE } from './content/content.model';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { APP_RUNTIME_CONFIG } from './app.tokens';
import { Router } from '@angular/router';
import { AccountService } from './auth/account.service';
import { AppDialogService } from './services/app-dialog.service';
import { vi } from 'vitest';
import { Component } from '@angular/core';

@Component({ template: '' })
class RoutePlaceholder {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: APP_RUNTIME_CONFIG, useValue: {} }],
    }).compileComponents();
  });

  it('uses compact chrome for loaded sheets while keeping character creation and editing unchanged', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: '**', component: RoutePlaceholder }]);
    for (const [url, sheet] of [
      ['/characters/hero', true], ['/characters/new', false],
      ['/characters/hero/edit', false], ['/sheet', true], ['/content', false],
    ] as const) {
      await router.navigateByUrl(url);
      expect(fixture.componentInstance.sheetOpen()).toBe(sheet);
    }
  });
  it('signs out when already on the login page, despite same-URL navigation being skipped', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/login');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(false);
    vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(true);
    const signOut = vi.spyOn(TestBed.inject(AccountService), 'signOut').mockResolvedValue();
    await fixture.componentInstance.signOut();
    expect(signOut).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not sign out if the current editor cancels navigation', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/characters/hero/edit');
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(false);
    vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(true);
    const signOut = vi.spyOn(TestBed.inject(AccountService), 'signOut').mockResolvedValue();
    await fixture.componentInstance.signOut();
    expect(signOut).not.toHaveBeenCalled();
  });
  it('keeps importing and displaying live progress across routes, including returning to Game Data', async () => {
    class FakeWorker {
      static instances: FakeWorker[] = [];
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { FakeWorker.instances.push(this); }
      receive(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('indexedDB', {});
    vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(DEFAULT_CONTENT_SOURCE);
    vi.spyOn(IndexedDbContentCache.prototype, 'saveSource').mockResolvedValue();
    const recover = vi.spyOn(IndexedDbContentCache.prototype, 'recover').mockResolvedValue(0);
    vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue(undefined);
    vi.spyOn(IndexedDbContentCache.prototype, 'revisions').mockResolvedValue([]);
    try {
      const fixture = TestBed.createComponent(App);
      const router = TestBed.inject(Router);
      router.resetConfig([
        { path: 'content', component: ContentImportComponent },
        { path: '**', component: RoutePlaceholder },
      ]);
      fixture.detectChanges();
      await router.navigateByUrl('/content');
      await fixture.whenStable();
      const state = fixture.componentInstance.contentImports;
      await state.start();
      const worker = FakeWorker.instances[0];
      expect(state.importing()).toBe(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[aria-label="Import status"]')).toHaveLength(1);
      for (const route of ['/compendium', '/characters/hero', '/content']) {
        await router.navigateByUrl(route);
        worker.receive({ type: 'progress', progress: { phase: 'download', completed: 3, total: 10, records: 42, bytes: 1048576, file: 'spells/test.json' } });
        fixture.detectChanges();
        const header = fixture.nativeElement.querySelector('.global-import-status');
        expect(header.textContent).toContain('Downloading Files');
        expect(header.textContent).toContain('3 / 10');
        expect(header.textContent).toContain('42 records');
        expect(header.querySelector('progress').value).toBe(3);
        expect(worker.terminate).not.toHaveBeenCalled();
        expect(worker.postMessage).toHaveBeenCalledTimes(1);
        expect(state.busy()).toBe(true);
      }
      expect(recover).toHaveBeenCalledTimes(1);
      expect(FakeWorker.instances).toHaveLength(1);
      // Cancellation remains an explicit action in the persistent header.
      await router.navigateByUrl('/compendium');
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.global-import-status button').click();
      expect(worker.postMessage).toHaveBeenLastCalledWith({ action: 'cancel' });
      worker.receive({ type: 'error', message: 'Import cancelled.' });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(state.busy()).toBe(false);
      expect(state.importing()).toBe(false);
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.querySelector('.global-import-status')).toBeNull();
      await router.navigateByUrl('/content');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Import cancelled.');
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

});
