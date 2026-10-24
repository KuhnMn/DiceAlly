import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { CharacterSyncService } from './character-sync.service';
import { AccountService } from '../../auth/account.service';
import { UiIconComponent } from '../../ui-icon.component';
import { CharacterLibraryService } from '../character-library.service';

@Component({
  selector: 'app-sync-status',
  host: { '[class.compact]': 'compact()', '[class.details-open]': 'detailsOpen()' },
  styles: [`
    .sync-details.details-hidden { display: none; }
    @media (min-width: 1280px) {
      .sync-details.details-hidden { display: block; }
      .sync-summary { display: none; }
    }
  `],
  imports: [UiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-3 mb-3 rounded-lg bg-secondary-container text-on-secondary-container px-3 py-2 text-sm" aria-label="Character synchronization">
      @if (compact()) {
        <button type="button" class="sync-summary flex min-h-9 w-full items-center justify-between gap-2 text-left text-xs" [attr.aria-expanded]="detailsOpen()" (click)="detailsOpen.set(!detailsOpen())">
          <span role="status" [title]="lastSyncTitle()">{{ sync.busy() || sync.settings.busy() ? 'Syncing…' : sync.conflicts().length ? 'Sync conflicts: ' + sync.conflicts().length : sync.error() || sync.settings.error() ? 'Saved locally · Sync needs attention' : sync.pending() + sync.settings.pending() ? 'Pending changes: ' + (sync.pending() + sync.settings.pending()) : lastSyncText() }}</span>
          <span>{{ detailsOpen() ? 'Hide' : 'Details' }}</span>
        </button>
      }
      <div [class.details-hidden]="compact() && !detailsOpen()" class="sync-details">
      <div class="flex flex-wrap items-center gap-2">
        @if (sync.busy() || sync.settings.busy()) { <app-ui-icon name="loader" class="animate-spin sm:!inline-flex" [class.hidden]="compact()" /> }
        <span role="status" [title]="lastSyncTitle()" [class.hidden]="compact()" class="sm:!inline">{{ sync.busy() || sync.settings.busy() ? 'Syncing…' : sync.error() || sync.settings.error() ? 'Saved Locally · Sync Needs Attention' : sync.pending() + sync.settings.pending() ? 'Pending Changes: ' + (sync.pending() + sync.settings.pending()) : lastSyncText() }}</span>
        <button class="rounded-lg px-3 py-1 bg-primary text-on-primary disabled:opacity-50" [disabled]="sync.busy()" (click)="sync.sync()">Sync Now</button>
        @if (sync.conflicts().length) {
          <button class="rounded-lg px-3 py-1 bg-surface text-on-surface" (click)="expanded.set(!expanded())">{{ expanded() ? 'Hide Conflicts' : 'Resolve Conflicts' }} ({{ sync.conflicts().length }})</button>
        }
        <span class="min-w-0 truncate text-xs sm:ml-auto" [title]="account.user()?.email || ''">{{ account.user()?.email }}</span>
        <button class="shrink-0 rounded-lg px-3 py-1 bg-surface text-on-surface" (click)="signOut.emit()">Sign Out</button>
      </div>
      </div>
      @if (sync.error()) { <p class="mt-2 text-xs" role="alert">{{ sync.error() }}</p> }
      @if (sync.settings.error()) { <p class="mt-2 text-xs" role="alert">{{ sync.settings.error() }}</p> }
      @if (expanded()) {
        <p class="mt-3 text-xs">Both versions remain stored until you choose. Reopen an already open sheet or editor after choosing a version.</p>
        @for (record of sync.conflicts(); track record.id) {
          <article class="mt-2 rounded-lg bg-surface p-3 text-on-surface">
            <h2 class="font-semibold">{{ record.sheet.character?.name || 'Character' }}</h2>
            <p class="text-xs mt-1">This device: {{ record.deletedAt ? 'Deleted' : 'Edited' }} · {{ record.updatedAt }}</p>
            <p class="text-xs">Cloud: {{ record.conflict?.deleted ? 'Deleted' : 'Edited' }} · {{ record.conflict?.updatedAt }}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <button class="rounded-lg px-3 py-1.5 bg-primary text-on-primary disabled:opacity-50" [disabled]="sync.busy()" (click)="sync.resolve(record.id, 'both')">Keep Both</button>
              <button class="rounded-lg px-3 py-1.5 bg-secondary-container text-on-secondary-container disabled:opacity-50" [disabled]="sync.busy()" (click)="sync.resolve(record.id, 'local')">Use This Device</button>
              <button class="rounded-lg px-3 py-1.5 bg-secondary-container text-on-secondary-container disabled:opacity-50" [disabled]="sync.busy()" (click)="sync.resolve(record.id, 'cloud')">Use Cloud</button>
            </div>
          </article>
        }
      }
    </section>
  `,
})
export class SyncStatusComponent implements OnDestroy {
  readonly compact = input(false);
  readonly detailsOpen = signal(false);
  readonly account = inject(AccountService);
  readonly signOut = output<void>();
  readonly sync = inject(CharacterSyncService);
  readonly expanded = inject(CharacterLibraryService).showSyncConflicts;
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.now.set(Date.now()), 10_000);
  readonly lastSyncTitle = computed(() => {
    const time = this.sync.lastSuccessfulSync();
    return time === null ? 'No successful sync in this session yet' : `Last successful sync: ${new Date(time).toLocaleString()}`;
  });
  readonly lastSyncText = computed(() => {
    const time = this.sync.lastSuccessfulSync();
    if (time === null) return 'Not Synced Yet';
    const minutes = Math.floor(Math.max(0, this.now() - time) / 60_000);
    return minutes < 1 ? 'Last Synced Just Now' : minutes < 60 ? `Last Synced ${minutes} Min Ago` : `Last Synced at ${new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });
  ngOnDestroy() { clearInterval(this.clock); }
}
