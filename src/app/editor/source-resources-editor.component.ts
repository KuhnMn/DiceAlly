import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { RESOURCE_RECOVERY_OPTIONS, resourcePlacement, SourceResource } from '../models/source-resources';
import { UiIconComponent } from '../ui-icon.component';
@Component({
  selector: 'app-source-resources-editor',
  imports: [FormsModule, UiIconComponent],
  styleUrls: ['./editor.css', './source-category-options.css', './source-resources-editor.component.css'],
  template: ` <section class="editor-card">
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="!mb-0">Resources</h2>
      <button
        type="button"
        class="action-button compact-button"
        [disabled]="!sources.length"
        (click)="add()"
      >
        <app-ui-icon name="plus" /> Resource
      </button>
    </div>
    @if (!sources.length) {
      <p class="text-sm text-on-surface-variant">Add a feature source first.</p>
    }
    <div class="space-y-2">
      @for (resource of sheet().resources ?? []; track resource.id) {
        <details
          class="rounded-lg border border-outline-variant bg-surface-container"
          [open]="newest === resource.id"
        >
          <summary class="cursor-pointer p-2 text-sm font-semibold">
            {{ resource.name }}
            <span class="text-xs font-normal text-on-surface-variant"
              >· {{ sourceName(resource.sourceId) }}</span
            >
          </summary>
          <div class="resource-fields border-t border-outline-variant p-2">
            <div class="grid grid-cols-2 gap-2">
              <label
                ><span class="field-label">Name</span
                ><input
                  class="editor-input"
                  [ngModel]="resource.name"
                  (ngModelChange)="resource.name = $event; change()"
                  [ngModelOptions]="{ standalone: true }"
              /></label>
              <label
                ><span class="field-label">Source</span
                ><select
                  class="editor-input"
                  [ngModel]="resource.sourceId"
                  (ngModelChange)="setSource(resource, $event)"
                  [ngModelOptions]="{ standalone: true }"
                >
                  @if (!hasSource(resource.sourceId)) {
                    <option [value]="resource.sourceId">Removed source</option>
                  }
                  @for (source of sources; track source.editorId ?? source.name) {
                    <option [value]="source.editorId">{{ source.name }}</option>
                  }
                </select></label
              >
            </div>
            <div class="resource-display-row">
              <label class="block"
                ><span class="field-label">Display</span
                ><select
                  class="editor-input"
                  [(ngModel)]="resource.mode"
                  (ngModelChange)="change()"
                  [ngModelOptions]="{ standalone: true }"
                >
                  <option value="counter">Uses</option>
                  <option value="note">Reminder</option>
                  <option value="both">Uses and Reminder</option>
                </select></label
              >
              @if (resource.mode !== 'counter') {
                <label class="block"
                  ><span class="field-label">Reminder / Dice</span
                  ><input
                    class="editor-input"
                    [(ngModel)]="resource.note"
                    (ngModelChange)="change()"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="For example: 3d6 Sneak Attack"
                /></label>
              }
            </div>
            @if (resource.mode !== 'note') {
              <div class="grid grid-cols-2 gap-2">
                <label
                  ><span class="field-label">Total Uses</span
                  ><input
                    class="editor-input"
                    type="number"
                    min="0"
                    step="1"
                    [ngModel]="resource.total"
                    (ngModelChange)="setTotal(resource, $event)"
                    [ngModelOptions]="{ standalone: true }"
                /></label>
                <label
                  ><span class="field-label">Recovery</span
                  ><select
                    class="editor-input"
                    [(ngModel)]="resource.recovery"
                    (ngModelChange)="change()"
                    [ngModelOptions]="{ standalone: true }"
                  >
                    @for (option of recoveries; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
                  </select></label
                >
              </div>
            }
            <fieldset class="min-w-0">
              <legend class="field-label">Show On</legend>
              <div class="grid grid-cols-2 gap-2">
              <label class="source-option"
                ><input
                  type="checkbox"
                  [(ngModel)]="resource.features"
                  (ngModelChange)="change()"
                  [ngModelOptions]="{ standalone: true }"
                />
                <app-ui-icon name="list" /><span>Features</span></label
              ><label class="source-option source-casting"
                ><input
                  type="checkbox"
                  [(ngModel)]="resource.spells"
                  (ngModelChange)="change()"
                  [ngModelOptions]="{ standalone: true }"
                />
                <app-ui-icon name="sparkles" /><span>Spells</span></label
              >
              </div>
            </fieldset>
            <button
              type="button"
              class="secondary-button compact-button"
              (click)="remove(resource)"
            >
              <app-ui-icon name="close" /> Remove Resource
            </button>
          </div>
        </details>
      } @empty {
        <p class="text-sm text-on-surface-variant">No resources configured.</p>
      }
    </div>
  </section>`,
})
export class SourceResourcesEditorComponent {
  readonly recoveries = RESOURCE_RECOVERY_OPTIONS;
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  newest = '';
  get sources() {
    return (this.sheet().character?.featureSources ?? []).filter((source) => source.name?.trim());
  }
  sourceName(id: string) {
    return this.sources.find((source) => source.editorId === id)?.name ?? 'Removed source';
  }
  hasSource(id: string) {
    return this.sources.some((source) => source.editorId === id);
  }
  change() {
    this.edited.emit();
  }
  add() {
    const source = this.sources[0];
    if (!source) return;
    for (const entry of this.sources) entry.editorId ??= crypto.randomUUID();
    const resource: SourceResource = {
      id: crypto.randomUUID(),
      sourceId: source.editorId!,
      name: 'New Resource',
      mode: 'counter',
      note: '',
      total: 1,
      used: 0,
      recovery: 'NONE',
      ...resourcePlacement(source),
    };
    (this.sheet().resources ??= []).push(resource);
    this.newest = resource.id;
    this.change();
  }
  setTotal(resource: SourceResource, total: number) {
    if (!Number.isSafeInteger(total) || total < 0) return;
    resource.total = total;
    this.change();
  }
  setSource(resource: SourceResource, id: string) {
    resource.sourceId = id;
    const source = this.sources.find(source => source.editorId === id);
    if (source) Object.assign(resource, resourcePlacement(source));
    this.change();
  }
  remove(resource: SourceResource) {
    this.sheet().resources = this.sheet().resources?.filter((entry) => entry.id !== resource.id);
    for (const entry of [...(this.sheet().features ?? []), ...(this.sheet().spells ?? [])])
      entry.resourceLinks = entry.resourceLinks?.filter((link) => link.resourceId !== resource.id);
    this.change();
  }
}
