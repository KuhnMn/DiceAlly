import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { ResourceCost } from '../models/source-resources';
@Component({
  selector: 'app-resource-links-editor',
  imports: [FormsModule, UiIconComponent],
  styleUrl: './editor.css',
  styles: [`.editor-input { min-height: 2rem; padding: .25rem .5rem; font-size: .8125rem; } .field-label { margin-bottom: .125rem; font-size: .6875rem; }`],
  template: ` <div class="space-y-2">
    @for (link of entry().resourceLinks ?? []; track $index; let i = $index) {
      <div class="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-end gap-2">
        <label
          ><span class="field-label">Resource</span
          ><select
            class="editor-input"
            [(ngModel)]="link.resourceId"
            (ngModelChange)="edited.emit()"
            [ngModelOptions]="{ standalone: true }"
          >
            @if (!has(link.resourceId)) {
              <option [value]="link.resourceId">Missing resource</option>
            }
            @for (resource of pools; track resource.id) {
              <option [value]="resource.id" [disabled]="linked(resource.id, link)">
                {{ resource.name }} · {{ sourceName(resource.sourceId) }}
              </option>
            }
          </select></label
        >
        <label
          ><span class="field-label">Cost</span
          ><input
            class="editor-input"
            type="number"
            min="1"
            step="1"
            [ngModel]="link.amount"
            (ngModelChange)="cost(link, $event)"
            [ngModelOptions]="{ standalone: true }"
        /></label>
        <button
          type="button"
          class="secondary-button compact-button"
          aria-label="Remove resource link"
          (click)="remove(i)"
        >
          <app-ui-icon name="close" />
        </button>
      </div>
    }
    @if (availablePool) {
      <button
        type="button"
        class="secondary-button compact-button"
        (click)="add()"
      >
        <app-ui-icon name="link" /> Link Resource
      </button>
    }
    @if (!pools.length) {
      <p class="text-xs text-on-surface-variant">
        Add a resource with uses under Feature (Re-)Sources first.
      </p>
    }
  </div>`,
})
export class ResourceLinksEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly entry = input.required<{ resourceLinks?: ResourceCost[] }>();
  readonly edited = output<void>();
  get pools() {
    return (this.sheet().resources ?? []).filter((resource) => resource.mode !== 'note');
  }
  get availablePool() {
    return this.pools.find(resource => !this.linked(resource.id));
  }
  has(id: string) {
    return this.pools.some((resource) => resource.id === id);
  }
  sourceName(id: string) {
    return (
      this.sheet().character?.featureSources?.find((source) => source.editorId === id)?.name ??
      'Removed source'
    );
  }
  linked(id: string, except?: ResourceCost) {
    return (
      this.entry().resourceLinks?.some((link) => link !== except && link.resourceId === id) ?? false
    );
  }
  add() {
    const pool = this.availablePool;
    if (pool) {
      (this.entry().resourceLinks ??= []).push({ resourceId: pool.id, amount: 1 });
      this.edited.emit();
    }
  }
  remove(index: number) {
    this.entry().resourceLinks!.splice(index, 1);
    this.edited.emit();
  }
  cost(link: ResourceCost, amount: number) {
    if (Number.isSafeInteger(amount) && amount > 0) {
      link.amount = amount;
      this.edited.emit();
    }
  }
}
