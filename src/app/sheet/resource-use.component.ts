import { Component, inject, input, signal } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { ResourceCost, resourceTotal, remainingResource, spendResource } from '../models/source-resources';
import { CharacterStore } from '../stores/character.store';
import { UiIconComponent } from '../ui-icon.component';
import { ResourceSelectComponent, ResourceSelectOption } from './resource-select.component';
@Component({
  selector: 'app-resource-use',
  host: { class: 'block min-w-0' },
  imports: [UiIconComponent, ResourceSelectComponent],
  template: `@if (selected(); as cost) {
    <section aria-label="Use feature resource" class="mt-3 flex min-w-0 items-end gap-2">
      <app-resource-select class="min-w-0 flex-1" label="Resource" ariaLabel="Use resource"
        [value]="cost.resourceId" [options]="options()" [selectable]="links().length > 1" (changed)="select($event)" />
      <button type="button" [disabled]="!available(cost)" (click)="use()" [attr.aria-label]="'Use ' + cost.amount + ' ' + name(cost)" [title]="'Cost: ' + cost.amount + ' ' + name(cost)"
        class="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary">
        <app-ui-icon name="hand" /> Use <span class="tabular-nums">({{ cost.amount }})</span>
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
  balance(cost: ResourceCost) {
    const resource = this.data().resources?.find(resource => resource.id === cost.resourceId);
    const remaining = resource && resource.mode !== 'note' ? remainingResource(resource, this.data()) : 0;
    return `${remaining}/${resource ? resourceTotal(resource, this.data()) : 0}`;
  }
  options(): ResourceSelectOption[] {
    return this.links().map(cost => {
      const resource = this.data().resources?.find(resource => resource.id === cost.resourceId);
      return { value: cost.resourceId, label: this.name(cost), balance: this.balance(cost),
        recovery: resource ? (resource.recovery === 'NONE' ? 'MANUAL' : resource.recovery) : undefined };
    });
  }
  available(cost: ResourceCost) {
    const resource = this.data().resources?.find((resource) => resource.id === cost.resourceId);
    return (
      this.isCurrent() && Number.isSafeInteger(cost.amount) &&
      cost.amount > 0 &&
      !!resource &&
      resource.mode !== 'note' &&
      remainingResource(resource, this.data()) >= cost.amount
    );
  }
  use(cost = this.selected()) {
    if (!cost || !this.available(cost) || !this.links().some(link => link.resourceId === cost.resourceId && link.amount === cost.amount)) return;
    const next = spendResource(this.data(), cost);
    if (next) this.store.setCharacter(next);
  }
}
