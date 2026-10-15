import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { CharacterLibraryService } from './character-library.service';
import { UiIconComponent } from '../ui-icon.component';

/** Compare persisted edit versions, never the mutable sheet currently being played or edited. */
@Component({
  selector: 'app-character-update-notice',
  imports: [UiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (available()) {
      <aside class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-primary bg-primary-container p-3 text-on-primary-container shadow-sm" role="status" aria-label="Current character update">
        <app-ui-icon name="info" class="text-xl shrink-0" />
        <div class="flex-1 min-w-0 basis-48">
          <p class="text-sm font-bold break-words">{{ conflicted() ? 'Conflicting Character Versions' : deleted() ? 'Character Deleted' : 'Updated Version Available' }} · {{ characterName() || 'This Character' }}</p>
          <p class="mt-1 text-xs">{{ conflicted() ? 'This character has different local and cloud changes. Choose which version to keep using the account sync controls above.' : deleted() ? 'This character was deleted on another device or tab.' : 'Your open character is showing an older saved version. Refresh to load the latest changes.' }}</p>
        </div>
        <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50" [disabled]="busy()" (click)="act()"><app-ui-icon name="reset" />{{ conflicted() ? 'Review Conflict' : deleted() ? 'Back to Characters' : 'Refresh Now' }}</button>
      </aside>
    }
  `,
})
export class CharacterUpdateNoticeComponent {
  readonly characterId = input<string | null | undefined>();
  readonly characterName = input('');
  readonly loadedVersion = input(0);
  readonly busy = input(false);
  readonly refresh = output<void>();
  readonly available = signal(false);
  readonly deleted = signal(false);
  readonly conflicted = signal(false);
  private readonly library = inject(CharacterLibraryService);
  constructor() {
    effect(onCleanup => {
      const id = this.characterId();
      const version = this.loadedVersion();
      this.library.changed();
      let active = true;
      onCleanup(() => { active = false; });
      this.available.set(false);
      if (!id || !version) return;
      void this.library.get(id).then(record => {
        if (!active) return;
        this.deleted.set(!record);
        this.conflicted.set(!!record?.conflict);
        this.available.set(!record || !!record.conflict || record.version > version);
      }).catch(() => { /* Persistence errors are reported by save/sync controls. */ });
    });
  }
  act() {
    if (this.conflicted()) {
      this.library.showSyncConflicts.set(true);
      document.querySelector('[aria-label="Character synchronization"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else this.refresh.emit();
  }
}
