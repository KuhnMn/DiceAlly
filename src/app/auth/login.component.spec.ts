import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AccountService } from './account.service';

describe('Password reset feedback', () => {
  function setup() {
    const resetPassword = vi.fn< (email: string) => Promise<void> >();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AccountService, useValue: {
      configured: true, accessible: signal(false), loading: signal(false), user: signal(null), approved: signal(false), error: signal(''), resetPassword,
    } }] });
    const fixture = TestBed.createComponent(LoginComponent); fixture.detectChanges();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Reset Password')) as HTMLButtonElement;
    return { fixture, button, resetPassword };
  }
  it('explains the required email when clicked on an empty form', () => {
    const { fixture, button, resetPassword } = setup();
    expect(button.disabled).toBe(false);
    button.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Enter your email address above');
    expect(resetPassword).not.toHaveBeenCalled();
  });
  it('shows progress and success without requiring a password', async () => {
    const { fixture, button, resetPassword } = setup();
    let finish!: () => void;
    resetPassword.mockImplementation(() => new Promise<void>(resolve => finish = resolve));
    fixture.componentInstance.email = 'test@example.com'; fixture.detectChanges();
    button.click(); fixture.detectChanges();
    expect(resetPassword).toHaveBeenCalledWith('test@example.com');
    expect(fixture.nativeElement.textContent).toContain('Requesting a password reset');
    finish(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('If the account exists');
    expect(button.disabled).toBe(false);
  });
  it('shows the Firebase error when the request fails', async () => {
    const { fixture, button, resetPassword } = setup();
    resetPassword.mockRejectedValue({ code: 'auth/network-request-failed' });
    fixture.componentInstance.email = 'test@example.com'; fixture.detectChanges();
    button.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('auth/network-request-failed');
    expect(button.disabled).toBe(false);
  });
});
