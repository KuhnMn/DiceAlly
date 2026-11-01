import { AbilityBonusSummaryComponent } from './sheet/ability-bonus-summary.component';
import { backgroundBonusSourceId } from './models/ability-score-bonuses';
import type { ExportedCharacter } from './models/character.model';
import { Component, input } from '@angular/core';
import { Background } from './models/character.model';
import { SheetDetailDialogComponent } from './sheet/sheet-detail-dialog.component';
import { EntryRendererComponent } from './entries/entry-renderer.component';

/** Library backgrounds can be inspected; name-only custom backgrounds remain plain text. */
@Component({
  selector: 'app-background-details',
  imports: [AbilityBonusSummaryComponent, SheetDetailDialogComponent, EntryRendererComponent],
  host: { class: 'inline' },
  template: `
    @if (background(); as value) {
      @if (value.entity) {
        <button type="button" class="min-h-8 text-primary underline" aria-haspopup="dialog" [attr.aria-label]="'View background ' + value.name" (click)="open = true">{{ label() || value.name }}</button>
        @if (open) {
          <app-sheet-detail-dialog [title]="value.name" [reference]="value.contentReference" [tags]="sourceTag" (closed)="open = false"><ng-template #sourceTag>@if (value.source) { <span class="rounded bg-surface-container-highest px-2 py-0.5 text-xs">{{ value.source }}</span> }</ng-template><app-ability-bonus-summary [sheet]="sheet()" [sourceId]="bonusSourceId(value)" /><app-entry-renderer [entries]="value.entity.entries ?? []" /></app-sheet-detail-dialog>
        }
      } @else { <span>{{ value.name }}</span> }
    }
  `,
})
export class BackgroundDetailsComponent {
  readonly sheet = input<ExportedCharacter | null>();
  readonly bonusSourceId = backgroundBonusSourceId;
  readonly background = input<Background>();
  readonly label = input('');
  open = false;
}
