import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService } from './account.service';
import { passwordResetErrorMessage, signInErrorMessage } from './auth-error';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-sm mx-auto p-5 rounded-xl bg-surface-container text-on-surface space-y-4">
      <h1 class="text-xl font-semibold">{{ account.accessible() ? 'Welcome to Dice Ally' : 'Sign In' }}</h1>
      <p class="text-sm text-on-surface-variant">{{ account.accessible() ? 'You are signed in and your account is approved.' : 'Sign in with your approved Dice Ally account.' }}</p>
      @if (!account.configured) {
        <p role="alert">Firebase is not configured. Set the environment variables and restart the app.</p>
      } @else if (account.loading()) {
        <p role="status">Checking account…</p>
      } @else if (account.initializationFailed()) {
        <button type="button" class="min-h-10 rounded-lg px-4 py-2 bg-primary text-on-primary" (click)="reload()">Reload App</button>
      } @else if (account.user()) {
        <p>{{ account.user()?.email }}</p>
        @if (!account.approved()) {
          <p role="status">Account access is not available yet. See the details below.</p>
          <p class="text-xs break-all">User UID: {{ account.user()?.uid }}</p>
        }
        <div class="flex flex-wrap gap-2">
          @if (account.approved()) {
            <button class="rounded-lg px-4 py-2 bg-primary text-on-primary" (click)="open()">Open Characters</button>
          } @else {
            <button class="rounded-lg px-4 py-2 bg-primary text-on-primary" (click)="account.checkApproval()">Check Approval Again</button>
          }
          @if (!account.approved()) {
            <button class="rounded-lg px-4 py-2 bg-secondary-container text-on-secondary-container" (click)="account.signOut()">Sign Out</button>
          }
        </div>
      } @else {
        <form class="space-y-3" (ngSubmit)="submit()">
          <label class="block text-sm">Email
            <input class="block w-full mt-1 rounded-lg p-2 bg-surface" name="email" type="email" autocomplete="username" [(ngModel)]="email" required>
          </label>
          <label class="block text-sm">Password
            <input class="block w-full mt-1 rounded-lg p-2 bg-surface" name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required>
          </label>
          <button class="rounded-lg px-4 py-2 bg-primary text-on-primary disabled:opacity-50" [disabled]="busy() || !email || !password">Sign In</button>
          <button type="button" class="rounded-lg px-3 py-2 text-primary disabled:opacity-50" [disabled]="busy()" (click)="reset()">Reset Password</button>
        </form>
      }
      @if (message() || account.error()) { <p class="text-sm" role="status">{{ message() || account.error() }}</p> }
    </section>
  `,
})
export class LoginComponent {
  readonly account = inject(AccountService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly message = signal('');
  email = '';
  password = '';
  reload() { window.location.reload(); }
  open() { void this.router.navigateByUrl('/'); }
  async submit() {
    this.busy.set(true);
    this.message.set('');
    try { await this.account.signIn(this.email, this.password); this.password = ''; }
    catch (error) { this.message.set(signInErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  async reset() {
    if (this.busy()) return;
    if (!this.email.trim()) {
      this.message.set('Enter your email address above, then click Reset Password. You do not need to enter a password.');
      return;
    }
    this.busy.set(true);
    this.message.set('Requesting a password reset…');
    try { await this.account.resetPassword(this.email); this.message.set('If the account exists, a password reset email will be sent.'); }
    catch (error) { this.message.set(passwordResetErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
