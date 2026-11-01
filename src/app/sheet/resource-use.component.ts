import { Component, inject, input, signal } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { ResourceCost, remainingResource, spendResource } from '../models/source-resources';
import { CharacterStore } from '../stores/character.store';
import { UiIconComponent } from '../ui-icon.component';
@Component({
  selector: 'app-resource-use',
  imports: [UiIconComponent],
  template: `@if (selected(); as cost) {
    <section aria-label="Use feature resource" class="mt-3 flex min-w-0 items-end gap-2">
      <div class="min-w-0 flex-1">
        @if (links().length > 1) {
          <label class="block text-xs font-semibold text-on-surface-variant">Resource
            <select aria-label="Use resource" [value]="cost.resourceId" (change)="select($any($event.target).value)"
              class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm">
              @for (option of links(); track $index) { <option [value]="option.resourceId">{{ label(option) }}</option> }
            </select>
          </label>
        } @else {
          <p class="text-xs font-semibold text-on-surface-variant">Resource</p>
          <output aria-live="polite" class="mt-1 flex min-h-11 items-center rounded-lg border border-outline-variant bg-surface-container px-2 py-2 text-base text-on-surface sm:text-sm">
            <span class="min-w-0 break-words">{{ label(cost) }}</span>
          </output>
        }
      </div>
      <button type="button" [disabled]="!available(cost)" (click)="use()" [attr.aria-label]="'Use ' + name(cost)"
        class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary">
        <app-ui-icon name="hand" /> Use
      </button>
    </section>
  }`,
})
export class ResourceUseComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly links = input<ResourceCost[]>([]);
  private readonly store = inject(CharacterStore);
  private readonly selectedId = signal<string | null>(null);
  selected(): ResourceCost | undefined {
    return this.links().find(cost => cost.resourceId === this.selectedId()) ?? this.links()[0];
  }
  select(id: string) { this.selectedId.set(id); }
  private data() {
    const current = this.store.characterData();
    return current && current.character?.characterUuid === this.sheet().character?.characterUuid
      ? current
      : this.sheet();
  }
  private isCurrent() {
    const current = this.store.characterData(), bound = this.sheet();
    return !current || current === bound || !!bound.character?.characterUuid && current.character?.characterUuid === bound.character.characterUuid;
  }
  name(cost: ResourceCost) {
    return (
      this.data().resources?.find((resource) => resource.id === cost.resourceId)?.name ??
      'Missing resource'
    );
  }
  label(cost: ResourceCost) {
    const resource = this.data().resources?.find(resource => resource.id === cost.resourceId);
    const remaining = resource && resource.mode !== 'note' ? remainingResource(resource) : 0;
    return `${this.name(cost)} · Cost ${cost.amount} · ${remaining} / ${resource?.total ?? 0} available`;
  }
  available(cost: ResourceCost) {
    const resource = this.data().resources?.find((resource) => resource.id === cost.resourceId);
    return (
      this.isCurrent() && Number.isSafeInteger(cost.amount) &&
      cost.amount > 0 &&
      !!resource &&
      resource.mode !== 'note' &&
      remainingResource(resource) >= cost.amount
    );
  }
  use(cost = this.selected()) {
    if (!cost || !this.available(cost) || !this.links().some(link => link.resourceId === cost.resourceId && link.amount === cost.amount)) return;
    const next = spendResource(this.data(), cost);
    if (next) this.store.setCharacter(next);
  }
}
