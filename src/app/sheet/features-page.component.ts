import { Component, inject, computed, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter, Speeds } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';

@Component({
  selector: 'app-features-page',
  imports: [CommonModule, EntryRendererComponent, FeatureUsesComponent],
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
    <div class="bg-surface-container-highest p-8 rounded-lg border-2 border-outline  shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Features & Traits</h2>
      @if (species()) {
        <h3 class="text-xl font-bold mb-3 mt-6">Species</h3>
        <div
          id="species-section"
          class="mb-8 border-2 border-rose rounded-lg p-4 bg-surface-container"
          [class.flash-highlight]="highlightedId() === 'species-section'"
        >
          <!-- Header (always visible, clickable) -->
          <button 
            type="button"
            class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2"
            (click)="toggleExpanded('species')">
            <div class="flex flex-wrap items-center justify-between gap-2 w-full">
              <h3 class="text-2xl font-bold text-rose"> {{ species()?.name ?? 'Unknown' }}</h3>
              <span class="text-xl text-rose font-bold">{{ isExpanded('species') ? '−' : '+' }}</span>
            </div>
          </button>

          <!-- Basic Info (always visible) -->
          <div class="flex flex-wrap items-center gap-2 mt-2">

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

          <!-- Expandable Content -->
          @if (isExpanded('species')) {
            <div class="mt-3 pt-3 border-t border-outline-variant">

              @if (species()?.entity?.entries?.length) {
                <div class="mt-3">
                  <app-entry-renderer [entries]="species()?.entity?.entries ?? []"></app-entry-renderer>
                </div>
              }

            </div>
          }
                        @if (species()?.uses?.length) {
                <div class="mt-4 border-t border-outline-variant pt-4">
                  @for (use of species()?.uses ?? []; track use.tag) {
                    <app-feature-uses 
                      [uses]="use"
                      (usesUpdated)="updateSpeciesUses($event)"
                    />
                  }
                </div>
              }
        </div>
      }
      <h3 class="text-xl font-bold mb-3 mt-6">Features</h3>

      <div class="mb-6 space-y-4">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <span class="text-sm font-semibold text-on-surface">Type:</span>
          @for (type of featureTypes(); track type) {
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded-full"
              [class.bg-blue]="featureTypeFilter() === type"
              [class.text-on-blue]="featureTypeFilter() === type"
              [class.border-blue]="featureTypeFilter() === type"
              [class.border-outline-variant]="featureTypeFilter() !== type"
              (click)="featureTypeFilter.set(type)"
            >
              {{ type }}
            </button>
          }
        </div>
        <div>
          <div class="mb-3">
            <span class="text-sm font-semibold text-on-surface">Source:</span>
          </div>
          @if (featureSourceStats().length > 0) {
            <div class="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
              <button
                type="button"
                class="text-left border-2 rounded-lg p-3 transition-colors"
                [class.bg-blue-container]="featureSourceFilter() === 'ALL'"
                [class.border-blue]="featureSourceFilter() === 'ALL'"
                [class.text-on-blue-container]="featureSourceFilter() === 'ALL'"
                [class.bg-surface-container]="featureSourceFilter() !== 'ALL'"
                [class.border-outline-variant]="featureSourceFilter() !== 'ALL'"
                [class.text-on-surface]="featureSourceFilter() !== 'ALL'"
                (click)="featureSourceFilter.set('ALL')"
              >
                <div class="text-sm font-semibold text-center">ALL</div>
              </button>
              @for (source of featureSourceStats(); track source.name) {
                <button
                  type="button"
                  class="text-center border-2 rounded-lg p-3 transition-colors wrap-break-word"
                  [class.bg-blue-container]="featureSourceFilter() === source.name"
                  [class.border-blue]="featureSourceFilter() === source.name"
                  [class.bg-surface-container]="featureSourceFilter() !== source.name"
                  [class.border-outline-variant]="featureSourceFilter() !== source.name"
                  (click)="featureSourceFilter.set(source.name)"
                >
                  <div class="text-sm font-semibold" [class.text-on-blue-container]="featureSourceFilter() === source.name" [class.text-on-surface]="featureSourceFilter() !== source.name">{{ source.name }}</div>
                  <div class="mt-2 grid gap-2">
                    @for (stat of source.abilities; track stat.ability) {
                      <div class="flex flex-wrap items-center gap-2 text-sm  justify-center" [class.text-on-blue-container]="featureSourceFilter() === source.name" [class.text-on-surface-variant]="featureSourceFilter() !== source.name">
                        <span class="font-semibold w-full">{{ stat.ability }}</span>
                        <div class="flex items-center gap-4">
                        <div>
                                                  <div>Attack </div>
                        <div class="text-tertiary">{{ stat.attack }}</div>
                        </div>
                        <div>
                          <div>Save DC</div><div class="text-primary">{{ stat.save }}</div>
                        </div>
                        
                        </div>
                      </div>
                    }
                  </div>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <div class="space-y-4">
        @if (sortedFeatures().length > 0) {
          @for (feature of sortedFeatures(); track feature.name) {
            <div
              class="border-2 border-blue rounded-lg p-4 bg-surface-container transition-colors"
              [attr.id]="featureAnchorId(feature)"
              [class.flash-highlight]="highlightedId() === featureAnchorId(feature)"
            >
                <!-- Header (always visible, clickable) -->
                <button 
                  type="button"
                  class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2"
                  (click)="toggleExpanded(featureAnchorId(feature) ?? 'feature')"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2 w-full">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-xl font-bold text-blue">{{ feature.name }}</h3>
                      @if (feature.featureType !== undefined) {
                        <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded">{{ helpers.featureTypeLabel(feature) }}</span>
                      }
                    </div>
                    <span class="text-xl text-blue font-bold">{{ isExpanded(featureAnchorId(feature) ?? 'feature') ? '−' : '+' }}</span>
                  </div>
                  <div class="text-sm text-on-surface-container-low mt-1">Level: {{ helpers.featureLevel(feature) }}</div>
                </button>

                <!-- Basic Info (always visible) -->
                <div class="flex flex-wrap items-center gap-2 mt-2">
                  @if (feature.source) {
                    <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ feature.source }}</span>
                  }
                  @if (feature.featureSourceName) {
                    <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ feature.featureSourceName }}</span>
                  }
                </div>

                <!-- Expandable Content -->
                @if (isExpanded(featureAnchorId(feature) ?? 'feature')) {
                  <div class="mt-3 pt-3 border-t border-outline-variant">
                    @if (feature.featEntity?.category) {
                      <div class="text-sm text-on-surface-variant">Feat Category: {{ feature.featEntity?.category }}</div>
                    }
                    @if ((feature.featEntity?.prerequisite?.length ?? 0) > 0) {
                      <div class="text-sm text-on-surface-variant">Prerequisites: {{ helpers.prerequisiteText(feature.featEntity?.prerequisite ?? []) }}</div>
                    }
                    <div class="mt-3" [attr.id]="feature.featureSourceName ? 'source-' + helpers.sourceId(feature.featureSourceName) : null">
                      <app-entry-renderer [entries]="helpers.featureEntries(feature)"></app-entry-renderer>
                    </div>

                  </div>

                }
                    @if (feature.uses?.length) {
                      <div class="mt-4 border-t border-outline-variant pt-4">
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

  featureTypeFilter = signal<'ALL' | 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE'>('ALL');
  featureSourceFilter = signal<string>('ALL');

  species = computed(() => this.characterData()?.species ?? null);
  featureSourceStats = computed(() => this.buildFeatureSourceStats());
  speciesCreatureTypes = computed(() => {
    return this.species()?.entity?.creatureTypes?.map(t => `${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`).join(', ') ?? '';
  });

  constructor() {
    effect(() => {
      const targetId = this.store.featureScrollTarget();
      if (!targetId) return;
      if (typeof document === 'undefined') return;
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  toggleExpanded(id: string) {
    const expanded = this.expandedItems();
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    this.expandedItems.set(new Set(expanded));
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

  featureAnchorId(feature: { name?: string; source?: string }): string | null {
    if (!feature?.name) return null;
    const base = `${feature.name}-${feature.source ?? ''}`;
    return `feature-${this.helpers.sourceId(base)}`;
  }

  private buildFeatureSourceStats() {
    const character = this.characterData()?.character ?? null;
    const sources = character?.featureSources?.filter((source) => source.isGeneralFeatureSource) ?? [];
    const profBonus = this.helpers.proficiencyBonus(character);

    return sources
      .map((source) => {
        const abilities = this.getFeatureSourceAbilities(source)
          .map((ability) => {
            const score = this.helpers.abilityScoreValue(character, ability);
            if (typeof score !== 'number') return null;
            const mod = this.helpers.modifierNumber(score);
            return {
              ability: ability.toUpperCase(),
              attack: this.helpers.formatSigned(mod + profBonus),
              save: 8 + profBonus + mod,
            };
          })
          .filter((entry): entry is { ability: string; attack: string; save: number } => !!entry);

        return {
          name: source.name ?? 'Feature Source',
          abilities,
        };
      })
      .filter((entry) => entry.abilities.length > 0);
  }

  private getFeatureSourceAbilities(source: {
    usesStrength?: boolean;
    usesDexterity?: boolean;
    usesConstitution?: boolean;
    usesIntelligence?: boolean;
    usesWisdom?: boolean;
    usesCharisma?: boolean;
  }): string[] {
    const abilities: string[] = [];

    if (source.usesStrength) abilities.push('str');
    if (source.usesDexterity) abilities.push('dex');
    if (source.usesConstitution) abilities.push('con');
    if (source.usesIntelligence) abilities.push('int');
    if (source.usesWisdom) abilities.push('wis');
    if (source.usesCharisma) abilities.push('cha');

    return abilities;
  }
}
