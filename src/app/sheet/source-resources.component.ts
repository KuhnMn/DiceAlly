import { Component, inject, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { SourceResource } from '../models/source-resources';
import { CharacterStore } from '../stores/character.store';
import { FeatureUsesComponent } from './feature-uses.component';
@Component({
  selector: 'app-source-resources',
  imports: [FeatureUsesComponent],
  host: { class: 'block min-w-0' },
  template: `@if (resources.length) {
    <section
      class="mb-4 rounded-lg border-2 p-2"
      [class.border-purple]="page() === 'spells'"
      [class.border-blue]="page() === 'features'"
      aria-label="Resources"
    >
      <h3 class="mb-2 text-lg font-bold">Resources</h3>
      <div class="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
        @for (resource of resources; track resource.id) {
          <div class="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-2">
            <p class="mb-1 text-xs text-on-surface-variant">{{ sourceName(resource.sourceId) }}</p>
            @if (resource.mode !== 'note') {
              <app-feature-uses
                [uses]="{
                  tag: resource.name,
                  totalFreeUses: resource.total,
                  usedFreeUses: resource.used,
                  freeUsesRegainCondition:
                    resource.recovery === 'NONE' ? 'MANUAL' : resource.recovery,
                }"
                (usesUpdated)="update(resource.id, $event.usedFreeUses)"
              />
            } @else {
              <h4 class="text-sm font-semibold">{{ resource.name }}</h4>
            }
            @if (resource.mode !== 'counter') {
              <p class="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">
                {{ resource.note }}
              </p>
            }
          </div>
        }
      </div>
    </section>
  }`,
})
export class SourceResourcesComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly page = input.required<'features' | 'spells'>();
  private readonly store = inject(CharacterStore);
  get resources() {
    return (this.sheet().resources ?? []).filter((resource) => resource[this.page()]);
  }
  sourceName(id: string) {
    return (
      this.sheet().character?.featureSources?.find((source) => source.editorId === id)?.name ??
      'Removed source'
    );
  }
  update(id: string, used: number) {
    const current = this.store.characterData();
    const bound = this.sheet();
    if (current && current !== bound && (!bound.character?.characterUuid || current.character?.characterUuid !== bound.character.characterUuid)) return;
    const data =
      current && current.character?.characterUuid === this.sheet().character?.characterUuid
        ? current
        : this.sheet();
    this.store.setCharacter({
      ...data,
      resources: data.resources?.map((resource) =>
        resource.id === id ? { ...resource, used } : resource,
      ),
    });
  }
}
