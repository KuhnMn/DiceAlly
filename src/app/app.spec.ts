import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { APP_RUNTIME_CONFIG } from './app.tokens';
import { Router } from '@angular/router';
import { AccountService } from './auth/account.service';
import { AppDialogService } from './services/app-dialog.service';
import { vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: APP_RUNTIME_CONFIG, useValue: {} }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain('Dice Ally');
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
