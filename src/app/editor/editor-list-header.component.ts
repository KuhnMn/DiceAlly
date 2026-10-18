import { Component, input, model, output } from '@angular/core';

/** Shared heading and list actions for the feature, spell and monster editors. */
@Component({
  selector: 'app-editor-list-header',
  host: { class: 'contents' },
  styleUrl: './editor.css',
  template: `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div>
        <h2 class="!mb-0 text-lg font-bold text-primary">{{ title() }}</h2>
        <p class="text-xs text-on-surface-variant mt-1">{{ description() }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="secondary-button compact-button"
          [attr.aria-expanded]="visible()" [attr.aria-controls]="controlsId()"
          (click)="visible.set(!visible())">
          {{ visible() ? 'Hide List' : 'Show List' }} ({{ count() }})
        </button>
        <button type="button" class="action-button" aria-haspopup="dialog"
          (click)="add.emit()">+ Add {{ title() }}</button>
      </div>
    </div>
  `,
})
export class EditorListHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('Manage the entries on your character.');
  readonly count = input.required<number>();
  readonly controlsId = input.required<string>();
  readonly visible = model(true);
  readonly add = output<void>();
}
