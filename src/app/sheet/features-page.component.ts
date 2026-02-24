import { Component, inject, computed, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-features-page',
  imports: [CommonModule, EntryRendererComponent, FeatureUsesComponent],
  template: `
    <div class="bg-white p-8 rounded-lg border-2 border-gray-300 shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Features & Traits</h2>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-gray-700">Type:</span>
          @for (type of featureTypes(); track type) {
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded-full"
              [class.bg-sky-600]="featureTypeFilter() === type"
              [class.text-white]="featureTypeFilter() === type"
              [class.border-sky-600]="featureTypeFilter() === type"
              [class.border-gray-300]="featureTypeFilter() !== type"
              (click)="featureTypeFilter.set(type)"
            >
              {{ type }}
            </button>
          }
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-gray-700">Source:</span>
          @for (source of featureSourcesList(); track source) {
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded-full"
              [class.bg-sky-600]="featureSourceFilter() === source"
              [class.text-white]="featureSourceFilter() === source"
              [class.border-sky-600]="featureSourceFilter() === source"
              [class.border-gray-300]="featureSourceFilter() !== source"
              (click)="featureSourceFilter.set(source)"
            >
              {{ source }}
            </button>
          }
        </div>
      </div>

      <div class="space-y-4">
        @if (sortedFeatures().length > 0) {
          @for (feature of sortedFeatures(); track feature.name) {
            <div class="border-2 border-gray-300 rounded-lg p-4">
              <h3 class="text-xl font-bold text-sky-800">{{ feature.name }}</h3>
              @if (feature.featureSourceName) {
                <div class="text-sm text-gray-600 mb-2">Source: {{ feature.featureSourceName }}</div>
              } @else if (feature.source) {
                <div class="text-sm text-gray-600 mb-2">Source: {{ feature.source }}</div>
              }
              <div class="text-sm text-gray-600">Type: {{ helpers.featureTypeLabel(feature) }}</div>
              <div class="text-sm text-gray-600">Level: {{ helpers.featureLevel(feature) }}</div>
              @if (feature.featEntity?.category) {
                <div class="text-sm text-gray-600">Feat Category: {{ feature.featEntity?.category }}</div>
              }
              @if ((feature.featEntity?.prerequisite?.length ?? 0) > 0) {
                <div class="text-sm text-gray-600">Prerequisites: {{ helpers.prerequisiteText(feature.featEntity?.prerequisite ?? []) }}</div>
              }
              <div class="mt-3" [attr.id]="feature.featureSourceName ? 'source-' + helpers.sourceId(feature.featureSourceName) : null">
                <app-entry-renderer [entries]="helpers.featureEntries(feature)"></app-entry-renderer>
              </div>
              @if (feature.uses?.length) {
                <div class="mt-4 border-t border-gray-200 pt-4">
                  @for (use of feature.uses; track use.tag) {
                    <app-feature-uses 
                      [uses]="use"
                      (usesUpdated)="updateFeatureUses(feature, $event)"
                    />
                  }
                </div>
              }
            </div>
          }
        } @else {
          <p class="text-gray-500 italic">No features listed</p>
        }
      </div>
    </div>
  `,
})
export class FeaturesPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);

  featureTypeFilter = signal<'ALL' | 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE'>('ALL');
  featureSourceFilter = signal<string>('ALL');

  featureTypes = computed(() => {
    const items = this.characterData()?.features ?? [];
    const types = new Set(items.map((feature) => this.helpers.featureTypeLabel(feature)));
    return ['ALL', ...Array.from(types)] as Array<'ALL' | 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE'>;
  });

  featureSourcesList = computed(() => {
    const items = this.characterData()?.features ?? [];
    const sources = new Set(items.map((feature) => feature.featureSourceName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(sources).sort()];
  });

  sortedFeatures = computed(() => {
    const items = this.characterData()?.features ?? [];
    const typeFilter = this.featureTypeFilter();
    const sourceFilter = this.featureSourceFilter();
    const filtered = items.filter((feature) => {
      const matchesType = typeFilter === 'ALL' || this.helpers.featureTypeLabel(feature) === typeFilter;
      const matchesSource = sourceFilter === 'ALL' || feature.featureSourceName === sourceFilter;
      return matchesType && matchesSource;
    });
    return [...filtered].sort((a, b) => {
      const typeA = this.helpers.featureTypeOrder(a);
      const typeB = this.helpers.featureTypeOrder(b);
      if (typeA !== typeB) return typeA - typeB;
      const levelA = this.helpers.featureLevel(a);
      const levelB = this.helpers.featureLevel(b);
      if (levelA !== levelB) return levelA - levelB;
      return a.name.localeCompare(b.name);
    });
  });

  updateFeatureUses(feature: any, event: { usedFreeUses: number; tag?: string }) {
    // Find the matching use entry and update it
    if (feature.uses) {
      const useEntry = feature.uses.find((u: any) => u.tag === event.tag);
      if (useEntry) {
        useEntry.usedFreeUses = event.usedFreeUses;
      }
    }
  }
}
