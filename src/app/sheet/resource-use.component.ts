import { Component, inject, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { ResourceCost, remainingResource, spendResource } from '../models/source-resources';
import { CharacterStore } from '../stores/character.store';
@Component({
  selector: 'app-resource-use',
  template: ` <div class="flex flex-wrap gap-2">
    @for (cost of links(); track $index) {
      <button
        type="button"
        class="min-h-8 rounded-lg border border-outline-variant bg-primary-container px-2 py-1 text-sm text-on-primary-container disabled:opacity-40"
        [disabled]="!available(cost)"
        (click)="use(cost)"
      >
        Use {{ name(cost) }} · {{ cost.amount }}
      </button>
    }
  </div>`,
})
export class ResourceUseComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly links = input<ResourceCost[]>([]);
  private readonly store = inject(CharacterStore);
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
  use(cost: ResourceCost) {
    if (!this.isCurrent()) return;
    const next = spendResource(this.data(), cost);
    if (next) this.store.setCharacter(next);
  }
}
