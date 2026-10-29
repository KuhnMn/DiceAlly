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
});
