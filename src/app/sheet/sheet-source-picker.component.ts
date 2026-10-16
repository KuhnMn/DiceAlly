import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { FeatureSourcePickerComponent } from '../editor/feature-source-picker.component';
import { SourceStatsComponent } from './source-stats.component';
import { HorizontalRowDirective } from './horizontal-row.directive';

/** Reuses source options/stat calculations without changing the editor presentation. */
@Component({
  selector: 'app-sheet-source-picker',
  imports: [NgClass, SourceStatsComponent, HorizontalRowDirective],
  template: `
    <section class="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-2 sm:p-3" [attr.aria-label]="heading()">
      <h4 class="mb-2 text-xs font-semibold text-on-surface-variant">{{ heading() }}</h4>
      <div appHorizontalRow class="flex flex-wrap items-stretch gap-2">
        @for (option of options; track option.source ?? option.value) {
          <button type="button" class="min-h-11 rounded-lg border-2 px-3 py-2 text-center text-sm max-sm:w-max focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
            [ngClass]="value() === option.value ? activeClasses : 'border-outline-variant bg-surface-container'"
            [attr.aria-pressed]="value() === option.value" (click)="selected.emit(option.value)">
            <span class="font-semibold">{{ option.label }}</span>
            @if (option.source; as source) { <app-source-stats [stats]="stats(source)" /> }
          </button>
        }
      </div>
    </section>
  `,
})
export class SheetSourcePickerComponent extends FeatureSourcePickerComponent {}
