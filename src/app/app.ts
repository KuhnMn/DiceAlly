import { AppDialogComponent } from './app-dialog.component';
import { AppDialogService } from './services/app-dialog.service';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { AccountService } from './auth/account.service';
import { SyncStatusComponent } from './characters/sync/sync-status.component';
import { CharacterSyncService } from './characters/sync/character-sync.service';

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
  private hadAccess = false;
  constructor() {
    effect(() => {
      const accessible = this.account.accessible();
      if (this.hadAccess && !accessible) void this.router.navigateByUrl('/login');
      this.hadAccess = accessible;
    });
  }
  async signOut() {
    const warning = this.sync.busy() || this.sync.pending() || this.sync.settings.busy() || this.sync.settings.pending()
      ? 'Sync is running or changes are waiting to upload. Signing out stops further syncing; pending changes remain on this device for this account. They may not yet be available on other devices. Sign out anyway?'
      : 'Sign out of this device? Local character copies will remain stored for this account.';
    if (await this.dialogs.confirm(warning, 'Sign Out', 'Sign Out')) {
      // Navigate first so the editor's unsaved-change guard can cancel before the session ends.
      if (await this.router.navigateByUrl('/login')) await this.account.signOut();
    }
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
