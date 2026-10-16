import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetSourcePickerComponent } from './sheet-source-picker.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
import { Component, inject, computed, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter, FeatureNotes, Speeds } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';

@Component({
  selector: 'app-features-page',
  imports: [SheetDetailDialogComponent, UiIconComponent, SheetSourcePickerComponent, HorizontalRowDirective, CommonModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent],
  styles: [`
    .flash-highlight {
      animation: feature-flash 1.6s ease-out;
    }

    @keyframes feature-flash {
      0% {
        background-color: rgba(145, 201, 255, 0.5);
        box-shadow: 0 0 0 0 rgba(145, 201, 255, 0.8);

      }
      40% {
        background-color: rgba(145, 201, 255, 0.25);
        box-shadow: 0 0 0 8px rgba(145, 201, 255, 0.2);
        border-color: rgb(145, 201, 255);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(145, 201, 255, 0);
      }
    }

    #species-section.flash-highlight {
      animation: species-flash 1.6s ease-out;
    }

    @keyframes species-flash {
      0% {
        background-color: rgba(255, 178, 191, 0.5);
        box-shadow: 0 0 0 0 rgba(255, 178, 191, 0.8);
      }
      40% {
        background-color: rgba(255, 178, 191, 0.25);
        box-shadow: 0 0 0 8px rgba(255, 178, 191, 0.2);
        border-color: rgb(255, 178, 191);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(255, 178, 191, 0);
      }
    }
  `],
  template: `
    <div class="bg-surface-container-highest p-3 sm:p-8 rounded-lg border-2 border-outline  shadow-lg">
      <h2 class="text-xl sm:text-3xl font-bold mb-3 sm:mb-6">Features & Traits</h2>

      @if (species()) {
        <h3 class="text-xl font-bold mb-3 mt-6">Species</h3>
        <div
          id="species-section"
          class="mb-4 sm:mb-8 border-2 border-rose rounded-lg px-3 py-2 sm:p-4 bg-surface-container"
          [class.flash-highlight]="highlightedId() === 'species-section'"
        >
          <!-- Header (always visible, clickable) -->
          <button 
            type="button"
            class="w-full text-left hover:bg-surface-container-low transition-colors rounded py-1 sm:p-2 sm:-m-2"
            (click)="toggleExpanded('species')" aria-haspopup="dialog">
            <div class="flex flex-wrap items-center justify-between gap-2 w-full">
              <h3 class="text-lg font-bold text-rose sm:text-2xl"> {{ species()?.name ?? 'Unknown' }}</h3>
              <span class="text-xl text-rose font-bold"><app-ui-icon name="chevron" /></span>
            </div>
          </button>

          <!-- Basic Info (always visible) -->
          <div class="mt-1 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-2">

          </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-on-surface-container">
                @if (species()?.entity?.size?.length) {
                  <div>Size: {{ species()?.entity?.size?.join(', ') }}</div>
                }
                @if (species()?.entity?.speed) {
                  <div>Speed: {{ formatSpeeds(species()?.entity?.speed ?? null) }}</div>
                }
                @if (species()?.entity?.darkvision) {
                  <div>Darkvision: {{ species()?.entity?.darkvision }} ft.</div>
                }
                @if (species()?.entity?.creatureTypes?.length) {
                  <div>Creature Type: {{ speciesCreatureTypes() }}</div>
                }
              </div>
              @if (species()?.source) {
              <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ species()?.source }}</span>
            }

          <!-- Reference details open in a modal on every screen size. -->
          @if (!isExpanded('species')) {
                  <div class="space-y-3">
                    @for (use of species()?.uses ?? []; track use) {
                                        <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                                      }
                  </div>
                }
                <app-feature-notes [notes]="species()?.notes" (notesChanged)="updateSpeciesNotes($event)" />
                @if (isExpanded('species')) {
          <app-sheet-detail-dialog [title]="species()?.name ?? 'Species'" (closed)="toggleExpanded('species')">
            <div class="grid grid-cols-2 gap-2 text-sm">
              <span>Size: {{ species()?.entity?.size?.join(', ') || '—' }}</span>
              <span>Speed: {{ formatSpeeds(species()?.entity?.speed ?? null) }}</span>
              @if (species()?.entity?.darkvision) { <span>Darkvision: {{ species()?.entity?.darkvision }} ft.</span> }
              <span>{{ speciesCreatureTypes() }}</span>
              <span>{{ species()?.source }}</span>
            </div>
            <div class="mt-3 pt-3 border-t border-outline-variant">

              @if (species()?.entity?.entries?.length) {
                <div class="mt-3">
                  <app-entry-renderer [entries]="species()?.entity?.entries ?? []"></app-entry-renderer>
                </div>
              }

            </div>
              @if (species()?.uses?.length) {
                <div class="mt-2 sm:mt-4 border-t border-outline-variant pt-2 sm:pt-4">
                  <div class="space-y-3">
                    @for (use of species()?.uses ?? []; track use) {
                                        <app-feature-uses 
                                          [uses]="use"
                                          (usesUpdated)="use.usedFreeUses = $event.usedFreeUses"
                                        />
                                      }
                  </div>
                </div>
              }
              <app-feature-notes
                [notes]="species()?.notes"
                (notesChanged)="updateSpeciesNotes($event)"
              />
          </app-sheet-detail-dialog>
          }
        </div>
      }
      <h3 class="text-xl font-bold mb-3 mt-6">Features</h3>

      <div class="mb-6 space-y-4">
        <div appHorizontalRow class="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
          <span class="text-sm font-semibold text-on-surface">Type:</span>
          @for (type of featureTypes(); track type) {
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded-full"
              [class.bg-blue]="featureTypeFilter() === type"
              [attr.aria-pressed]="featureTypeFilter() === type"
              [class.text-on-blue]="featureTypeFilter() === type"
              [class.border-blue]="featureTypeFilter() === type"
              [class.border-outline-variant]="featureTypeFilter() !== type"
              (click)="featureTypeFilter.set(type)"
            >
              {{ type.toLowerCase().replaceAll('_', ' ') | titlecase }}
            </button>
          }
        </div>
        <div>
        @if (characterData()?.character; as character) {
          <app-feature-source-picker [character]="character" [sources]="pickerSources()"
            heading="Source" tone="features" [showManage]="false"
            [value]="featureSourceFilter()" [orphanNames]="featureSourcesList().slice(1)"
            (selected)="featureSourceFilter.set($event)" />
        }
        </div>
      </div>

      <label class="mb-3 block text-sm font-semibold">Search features
        <input type="search" [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" placeholder="Search by name" class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base font-normal sm:text-sm" />
      </label>
      <div class="space-y-2 sm:space-y-4">
        @if (sortedFeatures().length > 0) {
          @for (feature of sortedFeatures(); track feature.editorId ?? feature) {
            <div
              class="border-2 border-blue rounded-lg px-3 py-2 sm:p-4 bg-surface-container transition-colors"
              [attr.id]="featureAnchorId(feature)"
              [class.flash-highlight]="highlightedId() === featureAnchorId(feature)"
            >
                <!-- Header (always visible, clickable) -->
                <button 
                  type="button"
                  class="w-full text-left hover:bg-surface-container-low transition-colors rounded py-1 sm:p-2 sm:-m-2"
                  (click)="toggleExpanded(featureAnchorId(feature) ?? 'feature')" aria-haspopup="dialog"
                  [attr.aria-expanded]="isExpanded(featureAnchorId(feature) ?? 'feature')"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2 w-full">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-base sm:text-xl font-bold text-blue">{{ feature.name }}</h3>
                      @if (feature.featureType !== undefined) {
                        <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded">{{ helpers.featureTypeLabel(feature).replaceAll('_', ' ') | titlecase }}</span>
                      }
                    </div>
                    <span class="text-xl text-blue font-bold"><app-ui-icon name="chevron" /></span>
                  </div>
                  <div class="text-xs text-on-surface-variant mt-1">Level: {{ helpers.featureLevel(feature) }}</div>
                </button>

                <!-- Basic Info (always visible) -->
                <div class="mt-1 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-2">
                  @if (feature.source) {
                    <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ feature.source }}</span>
                  }
                  @if (feature.featureSourceName) {
                    <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ feature.featureSourceName }}</span>
                  }
                </div>

                <!-- Reference details open in a modal on every screen size. -->
                @if (!isExpanded(featureAnchorId(feature) ?? 'feature')) {
                  <div class="space-y-3">
                    @for (use of feature.uses ?? []; track use) {
                                        <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                                      }
                  </div>
                }
                <app-feature-notes [notes]="feature.notes" (notesChanged)="updateFeatureNotes(feature, $event)" />
                @if (isExpanded(featureAnchorId(feature) ?? 'feature')) {
                <app-sheet-detail-dialog [title]="feature.name" (closed)="toggleExpanded(featureAnchorId(feature) ?? 'feature')">
                  <p class="text-sm text-on-surface-variant">{{ helpers.featureTypeLabel(feature).replaceAll('_', ' ') | titlecase }} · Level {{ helpers.featureLevel(feature) }} · {{ feature.featureSourceName }} · {{ feature.source }}</p>
                  <div class="mt-3 pt-3 border-t border-outline-variant">
                    @if (feature.featEntity?.category) {
                      <div class="text-base text-on-surface">Feat Category: {{ feature.featEntity?.category }}</div>
                    }
                    @if ((feature.featEntity?.prerequisite?.length ?? 0) > 0) {
                      <div class="text-base text-on-surface">Prerequisites: {{ helpers.prerequisiteText(feature.featEntity?.prerequisite ?? []) }}</div>
                    }
                    @if (feature.optionalFeatureEntity?.featureType) {
                      <div class="text-base text-on-surface">Feature Type: {{ feature.optionalFeatureEntity?.featureType }}</div>
                    }
                    @if ((feature.optionalFeatureEntity?.prerequisite?.length ?? 0) > 0) {
                      <div class="text-base text-on-surface">Prerequisites: {{ helpers.prerequisiteText(feature.optionalFeatureEntity?.prerequisite ?? []) }}</div>
                    }
                    <div class="mt-3" [attr.id]="feature.featureSourceName ? 'source-' + helpers.sourceId(feature.featureSourceName) : null">
                      <app-entry-renderer [entries]="helpers.featureEntries(feature)"></app-entry-renderer>
                    </div>

                  </div>

                    @if (feature.uses?.length) {
                      <div class="mt-2 sm:mt-4 border-t border-outline-variant pt-2 sm:pt-4">
                        <div class="space-y-3">
                          @for (use of feature.uses; track use) {
                                                    <app-feature-uses
                                                      [uses]="use"
                                                      (usesUpdated)="use.usedFreeUses = $event.usedFreeUses"
                                                    />
                                                  }
                        </div>
                      </div>
                    }
                    <app-feature-notes
                      [notes]="feature.notes"
                      (notesChanged)="updateFeatureNotes(feature, $event)"
                    />
                </app-sheet-detail-dialog>
                }
            </div>
          }
        } @else {
          <p class="text-on-surface-variant italic">No features listed</p>
        }
      </div>
    </div>
  `,
})
export class FeaturesPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);
  store = inject(CharacterStore);

  highlightedId = signal<string | null>(null);
  expandedItems = signal<Set<string>>(new Set());

  readonly searchQuery = signal('');
  featureTypeFilter = signal<'ALL' | 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE'>('ALL');
  featureSourceFilter = signal<string>('ALL');

  species = computed(() => this.characterData()?.species ?? null);
  readonly pickerSources = computed(() => this.characterData()?.character?.featureSources?.filter(source => source.isGeneralFeatureSource) ?? []);
  speciesCreatureTypes = computed(() => {
    return this.species()?.entity?.creatureTypes?.map(t => `${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`).join(', ') ?? '';
  });

  constructor() {
    effect(() => {
      const targetId = this.store.featureScrollTarget();
      if (!targetId || (!targetId.startsWith('feature-') && targetId !== 'species-section')) return;
      if (targetId === 'species-section') this.expandedItems.set(new Set(['species']));
      if (targetId.startsWith('feature-')) {
        this.searchQuery.set('');
        this.featureTypeFilter.set('ALL');
        this.featureSourceFilter.set('ALL');
        this.expandedItems.update(values => new Set([targetId]));
      }
      if (typeof document === 'undefined') return;
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.highlightedId.set(targetId);
          setTimeout(() => this.highlightedId.set(null), 1600);
        }
        this.store.setFeatureScrollTarget(null);
      }, 0);
    });
  }

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
      return matchesType && matchesSource && feature.name.toLowerCase().includes(this.searchQuery().trim().toLowerCase());
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

  toggleExpanded(id: string) {
    this.expandedItems.set(this.isExpanded(id) ? new Set() : new Set([id]));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  updateFeatureUses(feature: any, event: { usedFreeUses: number; tag?: string }) {
    // Find the matching use entry and update it
    if (feature.uses) {
      const useEntry = feature.uses.find((u: any) => u.tag === event.tag);
      if (useEntry) {
        useEntry.usedFreeUses = event.usedFreeUses;
      }
    }
  }

  updateSpeciesUses(event: { usedFreeUses: number; tag?: string }) {
    const species = this.species();
    if (!species?.uses) return;
    const useEntry = species.uses.find((u: any) => u.tag === event.tag);
    if (useEntry) {
      useEntry.usedFreeUses = event.usedFreeUses;
    }
  }

  updateSpeciesNotes(event: FeatureNotes[]): void {
    const species = this.species();
    if (!species) return;
    species.notes = event;
  }

  updateFeatureNotes(feature: any, event: FeatureNotes[]): void {
    feature.notes = event;
  }

  formatSpeeds(speeds: Speeds | null): string {
    if (!speeds) return '—';
    const orderedKeys: Array<keyof Speeds> = ['walk', 'climb', 'swim', 'fly', 'burrow'];
    const parts = orderedKeys
      .map((key) => {
        const value = speeds[key];
        if (typeof value !== 'number') return null;
        const keyText = String(key);
        const label = keyText === 'walk' ? 'Walk' : keyText.charAt(0).toUpperCase() + keyText.slice(1);
        return `${label} ${value}`;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(', ') : '—';
  }

  featureAnchorId(feature: { name?: string; source?: string; editorId?: string }): string | null {
    if (!feature?.name) return null;
    const base = `${feature.name}-${feature.source ?? ''}`;
    return `feature-${feature.editorId ?? this.helpers.sourceId(base)}`;
  }


}
