import { compareSearchMatches } from '../search-ranking';
import { FEATURE_TYPES, FeatureType, featureCategories, featureCategoryLabel, matchesFeatureCategories } from '../editor/feature-selection';
import { FeatureFiltersComponent } from '../feature-filters.component';
import { featureFilterData, featureFilterOptions, matchesFeatureFilters } from '../editor/feature-selection';
import { ListControlsComponent } from '../list-controls.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
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
import { ExportedCharacter, FeatureEntryFull, FeatureNotes } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { speciesMovementText, speciesSenseRanges, speciesTraitText } from '../content/species-compatibility';
import { formatSizeNames } from '../size-names';
import { PrerequisiteDetailsComponent } from './prerequisite-details.component';

@Component({
  selector: 'app-features-page',
  imports: [PrerequisiteDetailsComponent, FeatureFiltersComponent, ListControlsComponent, SheetListLayoutComponent, SheetDetailDialogComponent, UiIconComponent, SheetSourcePickerComponent, HorizontalRowDirective, CommonModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent],
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
    <div class="bg-surface-container-highest p-3 sm:p-5 rounded-lg border-2 border-outline  shadow-lg">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-xl sm:text-3xl font-bold">Features & Traits</h2>
        <app-sheet-list-layout #listLayout />
      </div>

      @if (species()) {
        <h3 class="text-lg font-bold mb-2 mt-4">Species</h3>
        <div
          id="species-section"
          class="mb-4 sm:mb-8 border-2 border-rose rounded-lg px-3 py-2 sm:p-4 bg-surface-container"
          [class.flash-highlight]="highlightedId() === 'species-section'"
        >
          <!-- Header (always visible, clickable) -->
          <button 
            type="button"
            class="w-full text-left hover:bg-surface-container-low transition-colors rounded py-0.5"
            (click)="toggleExpanded('species')" aria-haspopup="dialog">
            <div class="flex min-w-0 items-center justify-between gap-2 w-full">
              <h3 class="min-w-0 truncate text-lg font-bold text-rose sm:text-2xl" [title]="species()?.name ?? 'Unknown'"> {{ species()?.name ?? 'Unknown' }}</h3>
              <span class="shrink-0 text-xl text-rose font-bold"><app-ui-icon name="chevron" /></span>
            </div>
          </button>

          <!-- Basic Info (always visible) -->
          <div class="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">

          </div>
              <div appHorizontalRow role="region" aria-label="Species details" tabindex="0" class="flex flex-nowrap items-center gap-4 overflow-x-auto overscroll-x-contain py-1 text-sm text-on-surface-container [&>*]:shrink-0 [&>*]:whitespace-nowrap">
                @if (species()?.entity?.size?.length) {
                  <div>Size: {{ speciesSize() }}</div>
                }
                @if (species()?.entity?.speed || species()?.entity?.definition) {
                  <div>Speed: {{ speciesMovement() }}</div>
                }
                @for (sense of speciesSenses(); track sense.sense) {
                  <div>{{ sense.label }}: {{ sense.rangeFeet }} ft.</div>
                }
                @if (speciesCreatureTypes()) {
                  <div>Creature Type: {{ speciesCreatureTypes() }}</div>
                }
              </div>
              <ng-template #speciesSourceTag>
                <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ species()?.source }}</span>
              </ng-template>
              @if (species()?.source) {
              <ng-container [ngTemplateOutlet]="speciesSourceTag" />
            }

          <!-- Reference details open in a modal on every screen size. -->
          @if (!isExpanded('species')) {
                  <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
                    @for (use of species()?.uses ?? []; track use) {
                                        <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                                      }
                  </div>
                }
                <app-feature-notes [notes]="species()?.notes" (notesChanged)="updateSpeciesNotes($event)" />
                @if (isExpanded('species')) {
          <app-sheet-detail-dialog [title]="species()?.name ?? 'Species'" [tags]="species()?.source ? speciesSourceTag : null" (closed)="toggleExpanded('species')">
            <div appHorizontalRow role="region" aria-label="Species details" tabindex="0" class="flex flex-nowrap items-center gap-4 overflow-x-auto overscroll-x-contain py-1 text-sm [&>*]:shrink-0 [&>*]:whitespace-nowrap">
              <span>Size: {{ speciesSize() || '—' }}</span>
              <span>Speed: {{ speciesMovement() }}</span>
              @for (sense of speciesSenses(); track sense.sense) { <span>{{ sense.label }}: {{ sense.rangeFeet }} ft.</span> }
              <span>{{ speciesCreatureTypes() }}</span>
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
                  <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
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
      <h3 class="text-lg font-bold mb-2 mt-4">Features</h3>
      <nav appHorizontalRow aria-label="Feature views" class="mb-3 flex flex-wrap gap-2">
        @for (view of featureViews; track view.value) {
          <button type="button" (click)="setFeatureView(view.value)" [attr.aria-pressed]="featureTypeFilter() === view.value"
            [class.bg-blue-container]="featureTypeFilter() === view.value" [class.text-on-blue-container]="featureTypeFilter() === view.value"
            class="min-h-11 rounded-lg border border-outline-variant px-3 py-1 text-sm">{{ view.label }}</button>
        }
      </nav>

      <div class="mb-3 space-y-2">
        <div>
        @if (characterData()?.character; as character) {
          <app-feature-source-picker [character]="character" [sources]="pickerSources()"
            heading="Source" tone="features" [showManage]="false"
            [value]="featureSourceFilter()" [orphanNames]="featureSourcesList().slice(1)"
            (selected)="featureSourceFilter.set($event)" />
        }
        </div>
      </div>

      <app-list-controls label="Search features" [query]="searchQuery()" (queryChange)="searchQuery.set($event)"
        [filterCount]="activeFilterCount()" (cleared)="clearFilters()">
        <app-feature-filters [kind]="featureTypeFilter() === 'FEAT' ? 'FEAT' : featureTypeFilter() === 'OPTIONAL_FEATURE' ? 'OPTIONAL_FEATURE' : 'CLASS_FEATURE'" [showClasses]="false" [levels]="featureFilterOptions().levels"
          [categories]="featureCategoryOptions()" [selectedCategories]="featureCategoriesFilter()" (selectedCategoriesChange)="featureCategoriesFilter.set($event)"
          [selectedLevels]="featureLevels()" (selectedLevelsChange)="featureLevels.set($event)" />
      </app-list-controls>
      <ng-template #featureTags let-feature>
        @if (helpers.featureTypeLabel(feature) === 'CLASS_FEATURE') {
          <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded">Level {{ helpers.featureLevel(feature) }}</span>
        }
        @if (helpers.featureTypeLabel(feature) === 'FEAT' && feature.featEntity?.category) {
          <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded" title="Feat category">{{ categoryLabel(feature.featEntity.category) }}</span>
        }
        @if (helpers.featureTypeLabel(feature) === 'OPTIONAL_FEATURE') {
          @for (type of feature.optionalFeatureEntity?.featureType ?? []; track $index) {
            <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded" title="Optional feature type">{{ categoryLabel(type) }}</span>
          }
        }
      </ng-template>
      <div class="space-y-4">
        @for (group of featureGroups(); track group.label) {
          <section>
            <h4 class="mb-2 border-b-2 border-blue pb-1 text-lg font-bold text-blue">{{ group.label }}</h4>
            <div class="sheet-entry-list" [class.sheet-entry-list-two-columns]="listLayout.columns() === 2" [class.sheet-entry-list-three-columns]="listLayout.columns() === 3">
          @for (feature of group.features; track feature.editorId ?? feature) {
            <div
              class="min-w-0 border-2 border-blue rounded-lg px-3 py-1.5 sm:py-2 bg-surface-container transition-colors"
              [attr.id]="featureAnchorId(feature)"
              [class.flash-highlight]="highlightedId() === featureAnchorId(feature)"
            >
                <!-- Header (always visible, clickable) -->
                <button 
                  type="button"
                  class="w-full text-left hover:bg-surface-container-low transition-colors rounded py-0.5"
                  (click)="toggleExpanded(featureAnchorId(feature) ?? 'feature')" aria-haspopup="dialog"
                  [attr.aria-expanded]="isExpanded(featureAnchorId(feature) ?? 'feature')"
                >
                  <div class="flex min-w-0 items-center justify-between gap-2 w-full">
                    <div class="sheet-entry-heading">
                      <h3 class="min-w-0 truncate text-base sm:text-xl font-bold text-blue" [title]="feature.name">{{ feature.name }}</h3>
                      <span class="sheet-entry-heading-tags">
                      <ng-container [ngTemplateOutlet]="featureTags" [ngTemplateOutletContext]="{ $implicit: feature }" />
                      </span>
                    </div>
                    <span class="shrink-0 text-xl text-blue font-bold"><app-ui-icon name="chevron" /></span>
                  </div>
                </button>

                <!-- Basic Info (always visible) -->
                <div class="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                  @if (feature.source) {
                    <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ feature.source }}</span>
                  }
                  @if (feature.featureSourceName) {
                    <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ feature.featureSourceName }}</span>
                  }
                </div>

                <!-- Reference details open in a modal on every screen size. -->
                @if (!isExpanded(featureAnchorId(feature) ?? 'feature')) {
                  <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
                    @for (use of feature.uses ?? []; track use) {
                                        <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                                      }
                  </div>
                }
                <app-feature-notes [notes]="feature.notes" (notesChanged)="updateFeatureNotes(feature, $event)" />
                @if (isExpanded(featureAnchorId(feature) ?? 'feature')) {
                <app-sheet-detail-dialog [title]="feature.name" [tags]="featureDialogTags" (closed)="toggleExpanded(featureAnchorId(feature) ?? 'feature')">
                  <ng-template #featureDialogTags>
                    <ng-container [ngTemplateOutlet]="featureTags" [ngTemplateOutletContext]="{ $implicit: feature }" />
                    @if (feature.featureSourceName) {
                      <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ feature.featureSourceName }}</span>
                    }
                    @if (feature.source) {
                      <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ feature.source }}</span>
                    }
                  </ng-template>
                  <div class="space-y-3 border-t border-outline-variant pt-3 md:border-t-0 md:pt-0">
                    <app-prerequisite-details [prerequisites]="feature.featEntity?.prerequisite ?? feature.optionalFeatureEntity?.prerequisite" />
                    <div [attr.id]="feature.featureSourceName ? 'source-' + helpers.sourceId(feature.featureSourceName) : null">
                      <app-entry-renderer [entries]="helpers.featureEntries(feature)"></app-entry-renderer>
                    </div>

                  </div>

                    @if (feature.uses?.length) {
                      <div class="mt-2 sm:mt-4 border-t border-outline-variant pt-2 sm:pt-4">
                        <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
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
            </div>
          </section>
        } @empty {
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
  featureTypeFilter = signal<'ALL' | FeatureType>('CLASS_FEATURE');
  readonly featureViews = FEATURE_TYPES;
  readonly categoryLabel = featureCategoryLabel;
  featureSourceFilter = signal<string>('ALL');
  readonly featureCategoriesFilter = signal<string[]>([]);
  readonly featureLevels = signal<number[]>([]);
  readonly featureFilterOptions = computed(() => featureFilterOptions(this.featuresInContext().map(featureFilterData)));
  readonly featureCategoryOptions = computed(() => [...new Set(this.featuresInContext().flatMap(feature => featureCategories(featureFilterData(feature), this.featureTypeFilter() === 'FEAT' ? 'FEAT' : 'OPTIONAL_FEATURE')))].sort());
  private readonly featuresInContext = computed(() => (this.characterData()?.features ?? []).filter(feature => (this.featureTypeFilter() === 'ALL' || this.helpers.featureTypeLabel(feature) === this.featureTypeFilter()) && (this.featureSourceFilter() === 'ALL' || feature.featureSourceName === this.featureSourceFilter())));
  readonly activeFilterCount = computed(() => this.featureTypeFilter() === 'CLASS_FEATURE' ? this.featureLevels().length : this.featureCategoriesFilter().length);
  clearFilters() {
    this.searchQuery.set(''); this.featureCategoriesFilter.set([]); this.featureLevels.set([]);
  }


  species = computed(() => this.characterData()?.species ?? null);
  readonly speciesMovement = computed(() => speciesMovementText(this.species()?.entity));
  readonly speciesSize = computed(() => formatSizeNames(this.species()?.entity?.size));
  readonly speciesSenses = computed(() => speciesSenseRanges(this.species()?.entity));
  readonly pickerSources = computed(() => this.characterData()?.character?.featureSources?.filter(source => source.isGeneralFeatureSource) ?? []);
  speciesCreatureTypes = computed(() => {
    const definition = this.species()?.entity?.definition;
    if (definition) return speciesTraitText(definition.creatureTypes);
    return this.species()?.entity?.creatureTypes?.map(t => `${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`).join(', ') ?? '';
  });

  constructor() {
    effect(() => {
      const targetId = this.store.featureScrollTarget();
      if (!targetId || (!targetId.startsWith('feature-') && targetId !== 'species-section')) return;
      if (targetId === 'species-section') this.expandedItems.set(new Set(['species']));
      if (targetId.startsWith('feature-')) {
        this.searchQuery.set('');
        const target = this.characterData()?.features?.find(feature => 'feature-' + (feature.editorId ?? this.helpers.sourceId(feature.name + '-' + (feature.source ?? ''))) === targetId);
        if (target) this.setFeatureView(this.helpers.featureTypeLabel(target) as FeatureType);
        this.featureSourceFilter.set('ALL');
        this.featureCategoriesFilter.set([]); this.featureLevels.set([]);
        this.expandedItems.set(new Set([targetId]));
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
    const levels = this.featureLevels(), categories = this.featureCategoriesFilter();
    const filtered = items.filter((feature) => {
      const matchesType = typeFilter === 'ALL' || this.helpers.featureTypeLabel(feature) === typeFilter;
      const matchesSource = sourceFilter === 'ALL' || feature.featureSourceName === sourceFilter;
      return matchesType && matchesSource && (typeFilter === 'CLASS_FEATURE' ? matchesFeatureFilters(featureFilterData(feature), [], levels) : typeFilter === 'ALL' || matchesFeatureCategories(featureFilterData(feature), typeFilter, categories)) && feature.name.toLowerCase().includes(this.searchQuery().trim().toLowerCase());
    });
    return [...filtered].sort((a, b) => {
      const relevance = compareSearchMatches(a.name, b.name, this.searchQuery());
      if (relevance) return relevance;
      const typeA = this.helpers.featureTypeOrder(a);
      const typeB = this.helpers.featureTypeOrder(b);
      if (typeA !== typeB) return typeA - typeB;
      const levelA = this.helpers.featureLevel(a);
      const levelB = this.helpers.featureLevel(b);
      if (levelA !== levelB) return levelA - levelB;
      return a.name.localeCompare(b.name);
    });
  });

  readonly featureGroups = computed(() => {
    const groups = new Map<string, FeatureEntryFull[]>();
    for (const feature of this.sortedFeatures()) {
      const type = this.helpers.featureTypeLabel(feature);
      const label = type === 'CLASS_FEATURE'
        ? `Class Features · Level ${this.helpers.featureLevel(feature)}`
        : type === 'FEAT'
          ? `Feats · ${feature.featEntity?.category?.trim() || 'Other'}`
          : `Optional Features · ${[...new Set(feature.optionalFeatureEntity?.featureType ?? [])].sort().join(', ') || 'Other'}`;
      const entries = groups.get(label) ?? [];
      entries.push(feature);
      groups.set(label, entries);
    }
    return [...groups].map(([label, features]) => ({ label, features }))
      .sort((a, b) => compareSearchMatches(a.features[0].name, b.features[0].name, this.searchQuery())
        || this.helpers.featureTypeOrder(a.features[0]) - this.helpers.featureTypeOrder(b.features[0])
        || a.label.localeCompare(b.label, undefined, { numeric: true }));
  });

  setFeatureView(type: FeatureType) {
    this.featureTypeFilter.set(type); this.featureLevels.set([]); this.featureCategoriesFilter.set([]);
  }

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



  featureAnchorId(feature: { name?: string; source?: string; editorId?: string }): string | null {
    if (!feature?.name) return null;
    const base = `${feature.name}-${feature.source ?? ''}`;
    return `feature-${feature.editorId ?? this.helpers.sourceId(base)}`;
  }


}
