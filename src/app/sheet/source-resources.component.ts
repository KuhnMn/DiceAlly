import { Component, inject, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { SourceResource } from '../models/source-resources';
import { CharacterStore } from '../stores/character.store';
import { FeatureUsesComponent } from './feature-uses.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
@Component({
  selector: 'app-source-resources',
  imports: [FeatureUsesComponent, HorizontalRowDirective],
  host: { class: 'block min-w-0' },
  template: `@if (resources.length) {
    <section
      class="mb-4"
      aria-label="Resources"
    >
      <h3 class="mb-2 text-xl font-bold sm:mb-3">Resources</h3>
      <div class="space-y-2">
        @for (group of groups; track group.sourceId) {
          <div class="border border-surface border-2 rounded-lg p-2 bg-surface-container">
            <div class="text-sm font-semibold text-on-surface mb-1.5">{{ sourceName(group.sourceId) }}</div>
            <div appHorizontalRow class="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
              @for (resource of group.resources; track resource.id) {
                <app-feature-uses class="max-sm:w-44" [poolLayout]="true" [tone]="page()" [trackUses]="resource.mode !== 'note'"
                  [note]="resource.mode !== 'counter' ? resource.note : ''"
                  [uses]="{tag:resource.name,totalFreeUses:resource.total,usedFreeUses:resource.used,
                    freeUsesRegainCondition:resource.recovery === 'NONE' ? 'MANUAL' : resource.recovery}"
                  (usesUpdated)="update(resource.id, $event.usedFreeUses)" />
              }
            </div>
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
  get groups() {
    const groups = new Map<string, {sourceId:string; resources:SourceResource[]}>();
    for (const resource of this.resources) {
      if (!groups.has(resource.sourceId)) groups.set(resource.sourceId,{sourceId:resource.sourceId,resources:[]});
      groups.get(resource.sourceId)!.resources.push(resource);
    }
    return [...groups.values()];
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
