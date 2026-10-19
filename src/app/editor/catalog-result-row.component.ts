import { Component, input, output } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

/** Compact acquisition row shared by every Add catalog. */
@Component({
  selector: 'app-catalog-result-row',
  imports: [UiIconComponent],
  host: { class: 'block min-w-0 border-b border-outline-variant last:border-b-0' },
  template: `
    <div class="relative flex min-w-0 items-stretch gap-2 px-2 py-1.5">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold leading-6" [title]="name()">{{ name() }}</p>
        <div class="flex min-w-0 items-center gap-1 text-[11px] leading-4"><ng-content select="[catalog-metadata]" /></div>
      </div>
      <ng-content select="[catalog-description]" />
      <button type="button" class="relative z-10 flex w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant text-lg disabled:opacity-60"
        [class.bg-blue-container]="selected()" [class.text-on-blue-container]="selected()"
        [class.already-added]="alreadyAdded() && !selected()"
        [attr.aria-label]="selected() ? name() + (selection() ? ' selected' : ' already added') : selection() ? 'Select ' + name() : 'Add ' + (alreadyAdded() ? 'another ' : '') + name() + ' to ' + destination()"
        [title]="selected() ? (selection() ? 'Selected' : 'Already added') : selection() ? 'Select ' + name() : alreadyAdded() ? 'Already added · Add another copy' : 'Add to ' + destination()" [disabled]="disabled() || selected()" (click)="addRequested.emit()">
        <app-ui-icon [name]="selected() ? 'check' : selection() ? 'circle-check' : 'list-plus'" />
      </button>
    </div>
  `,
  styles: [`
    .already-added {
      background-color: color-mix(in srgb, var(--md-extended-color-custom-color3-color-container) 25%, transparent);
      border-color: color-mix(in srgb, var(--md-extended-color-custom-color3-color) 35%, var(--md-sys-color-outline-variant));
    }
  `],
})
export class CatalogResultRowComponent {
  readonly name = input.required<string>();
  readonly destination = input('list');
  readonly selected = input(false);
  readonly alreadyAdded = input(false);
  readonly selection = input(false);
  readonly disabled = input(false);
  readonly addRequested = output<void>();
}
