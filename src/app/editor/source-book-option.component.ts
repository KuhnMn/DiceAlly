import { Component, computed, inject, input, output, signal } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';
import { SourceBookNamesService } from './source-book-names.service';

@Component({
  selector: 'app-source-book-option',
  imports: [UiIconComponent],
  template: `
    <div class="source-book-option">
      <label>
        <input type="checkbox" [checked]="selected()" (change)="selectedChange.emit($any($event.target).checked)" />
        <span>{{ expanded() && fullName() ? fullName() : book() }}</span>
      </label>
      @if (fullName() && fullName() !== book()) {
        <button type="button" class="secondary-button compact-button icon-button" (click)="expanded.set(!expanded())"
          [attr.aria-label]="toggleLabel()" [title]="toggleLabel()" [attr.aria-pressed]="expanded()">
          <app-ui-icon [name]="expanded() ? 'close' : 'info'" />
        </button>
      }
    </div>
  `,
  styleUrls: ['./editor.css', './source-book-option.component.css'],
})
export class SourceBookOptionComponent {
  readonly book = input.required<string>();
  readonly selected = input(false);
  readonly selectedChange = output<boolean>();
  readonly expanded = signal(false);
  private readonly names = inject(SourceBookNamesService);
  readonly fullName = computed(() => this.names.fullName(this.book()));
  readonly toggleLabel = computed(() => `${this.expanded() ? 'Show abbreviation' : 'Show full name'} for ${this.book()}`);
}
