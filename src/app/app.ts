import { AppDialogComponent } from './app-dialog.component';
import { AppDialogService } from './services/app-dialog.service';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { AccountService } from './auth/account.service';
import { SyncStatusComponent } from './characters/sync/sync-status.component';
import { CharacterSyncService } from './characters/sync/character-sync.service';
import { CharacterStore } from './stores/character.store';
import { UnsavedChangesGuard } from './guards/unsaved-changes.guard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgOptimizedImage, AppDialogComponent, SyncStatusComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' }
})
export class App {
  readonly account = inject(AccountService);
  readonly sync = inject(CharacterSyncService);
  private readonly router = inject(Router);
  private readonly characterStore = inject(CharacterStore);
  private readonly unsavedChanges = inject(UnsavedChangesGuard);
  readonly signingOut = signal(false);
  private hadAccess = false;
  constructor() {
    effect(() => {
      const accessible = this.account.accessible();
      if (this.hadAccess && !accessible) void this.router.navigateByUrl('/login');
      this.hadAccess = accessible;
    });
  }
  async signOut() {
    if (this.signingOut()) return;
    const warning = this.sync.busy() || this.sync.pending() || this.sync.settings.busy() || this.sync.settings.pending()
      ? 'Sync is running or changes are waiting to upload. Signing out stops further syncing; pending changes remain on this device for this account. They may not yet be available on other devices. Sign out anyway?'
      : 'Sign out of this device? Local character copies will remain stored for this account.';
    if (!await this.dialogs.confirm(warning, 'Sign Out', 'Sign Out')) return;
    this.signingOut.set(true);
    try {
      // Same-URL navigation is skipped and returns false. That must not cancel sign-out on /login.
      const onLoginPage = this.router.parseUrl(this.router.url).root.children['primary']?.segments.map(segment => segment.path).join('/') === 'login';
      if (!onLoginPage && !await this.router.navigateByUrl('/login')) return;
      await this.account.signOut();
      this.characterStore.clearNativeContext();
      this.characterStore.setCharacter(null);
      this.unsavedChanges.resetGuard();
    } catch {
      await this.dialogs.alert('Sign-out failed. Your session may still be active. Please try again.');
    } finally { this.signingOut.set(false); }
  }
  warnBeforeUnload(event: BeforeUnloadEvent) {
    if (this.account.accessible() && (this.sync.busy() || this.sync.pending() || this.sync.settings.busy() || this.sync.settings.pending())) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  readonly dialogs = inject(AppDialogService);
  // Initialize theme service to load/apply theme on startup
  private themeService = inject(ThemeService);
  
  protected readonly title = signal('Dice Ally');
}
