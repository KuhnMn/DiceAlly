import { Component, inject, computed, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-spells-page',
  imports: [CommonModule, EntryRendererComponent, FeatureUsesComponent],
  styles: [`
    .flash-highlight {
      animation: spell-flash 1.6s ease-out;
    }

    @keyframes spell-flash {
      0% {
        box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.6);
        border-color: #9333ea;
      }
      60% {
        box-shadow: 0 0 0 8px rgba(147, 51, 234, 0.15);
        border-color: #9333ea;
      }
      100% {
        box-shadow: 0 0 0 0 rgba(147, 51, 234, 0);
        border-color: #d1d5db;
      }
    }
  `],
  template: `
    <div class="bg-white p-8 rounded-lg border-2 border-gray-300 shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Spellcasting</h2>
      @if (spellSlotGroups().length > 0) {
          <h3 class="text-xl font-bold mb-3">Spell Slots</h3>
          <div class="space-y-4">
            @for (group of spellSlotGroups(); track group.source) {
              <div class="border border-gray-200 rounded-lg p-3">
                <div class="text-sm font-semibold text-gray-700 mb-3">{{ group.source }}</div>
                <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  @for (slot of group.slots; track slot.level) {
                    <div 
                      class="border border-gray-200 rounded-md p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      (click)="addOneSpellSlot(group.source, slot)"
                    >
                      <div class="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
                        <span>Level {{ slot.level }}</span>
                        <span>{{ slot.total-spellSlotUsed(group.source, slot) }} / {{ slot.total }}</span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          class="bg-purple-600 h-2 rounded-full transition-all"
                          [style.width.%]="spellSlotProgress(group.source, slot)"
                        ></div>
                      </div>
                      @if (slot.total > 0) {
                        <div class="flex flex-wrap gap-2" (click)="$event.stopPropagation()">
                          @for (index of spellSlotIndexes(slot.total); track index) {
                            <label class="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                [checked]="index < spellSlotUsed(group.source, slot)"
                                (change)="toggleSpellSlot(group.source, slot, index)"
                                class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                              />
                              <span class="ml-1 text-sm text-gray-600">{{ index + 1 }}</span>
                            </label>
                          }
                        </div>
                      } @else {
                        <p class="text-xs text-gray-500 italic">No slots available</p>
                      }
                      @if (slot.regainCondition) {
                        <div class="text-xs text-gray-500 mt-2" (click)="$event.stopPropagation()">Regain: {{ slot.regainCondition }}</div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
      }
      <h3 class="text-xl font-bold mb-3 mt-6">Spells</h3>
      <div class="mb-6 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-gray-700">List Type:</span>
        @for (type of spellListTypes(); track type) {
          <button
            type="button"
            class="px-3 py-1 text-sm border rounded-full"
            [class.bg-purple-600]="spellListTypeFilter() === type"
            [class.text-white]="spellListTypeFilter() === type"
            [class.border-purple-600]="spellListTypeFilter() === type"
            [class.border-gray-300]="spellListTypeFilter() !== type"
            (click)="spellListTypeFilter.set(type)"
          >
            {{ type }}
          </button>
        }
      </div>
      <div class="mb-6">
        <div class="mb-3">
          <span class="text-sm font-semibold text-gray-700">Casting Source:</span>
        </div>
        @if (featureSourceStats().length > 0) {
          <div class="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
            <button
              type="button"
              class="text-left border-2 rounded-lg p-3 transition-colors"
              [class.bg-purple-100]="spellCastingSourceFilter() === 'ALL'"
              [class.border-purple-600]="spellCastingSourceFilter() === 'ALL'"
              [class.bg-gray-50]="spellCastingSourceFilter() !== 'ALL'"
              [class.border-gray-200]="spellCastingSourceFilter() !== 'ALL'"
              (click)="spellCastingSourceFilter.set('ALL')"
            >
              <div class="text-sm font-semibold text-gray-800">ALL</div>
            </button>
            @for (source of featureSourceStats(); track source.name) {
              <button
                type="button"
                class="text-left border-2 rounded-lg p-3 transition-colors"
                [class.bg-purple-100]="spellCastingSourceFilter() === source.name"
                [class.border-purple-600]="spellCastingSourceFilter() === source.name"
                [class.bg-gray-50]="spellCastingSourceFilter() !== source.name"
                [class.border-gray-200]="spellCastingSourceFilter() !== source.name"
                (click)="spellCastingSourceFilter.set(source.name)"
              >
                <div class="text-sm font-semibold text-gray-800">{{ source.name }}</div>
                <div class="mt-2 grid gap-2">
                  @for (stat of source.abilities; track stat.ability) {
                    <div class="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                      <span class="font-semibold">{{ stat.ability }}</span>
                      <span>Attack {{ stat.attack }}</span>
                      <span>•</span>
                      <span>Save DC {{ stat.save }}</span>
                    </div>
                  }
                </div>
              </button>
            }
          </div>
        }
      </div>
      <div class="space-y-6">
        @if (spellsByLevel().length > 0) {
          @for (levelGroup of spellsByLevel(); track levelGroup.level) {
            <div>
              <h4 class="text-lg font-bold text-purple-900 mb-3 border-b-2 border-purple-200 pb-1">
                {{ spellLevelHeader(levelGroup.level) }}
              </h4>
              <div class="space-y-4">
                @for (spell of levelGroup.spells; track spell.name) {
                  <div class="border-2 border-gray-300 rounded-lg p-4" [attr.id]="'spell-' + helpers.sourceId(spell.name + '-' + (spell.source ?? ''))" [class.flash-highlight]=\"highlightedId() === ('spell-' + helpers.sourceId(spell.name + '-' + (spell.source ?? '')))\">
                    <!-- Header (always visible, clickable) -->
                    <button
                      type="button"
                      class="w-full text-left hover:bg-gray-50 transition-colors rounded p-2 -m-2"
                      (click)="toggleExpanded('spell-' + spell.name)"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 w-full">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-xl font-bold text-purple-800">{{ spell.name }}</h3>
                          @if (spell.entity?.level !== undefined) {
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{{ helpers.spellLevelLabel(spell) }}</span>
                          }
                          @if (spell.entity?.school) {
                            <span class="text-xs bg-mauve-100 text-mauve-700 px-2 py-0.5 rounded">{{ helpers.spellSchoolLabel(spell.entity?.school ?? '') }}</span>
                          }
                          @if (spell.entity?.meta?.ritual) {
                            <span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Ritual</span>
                          }
                          @if (spell.listType) {
                            <span class="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">{{ spell.listType }}</span>
                          }
                        </div>
                        <span class="text-xl text-purple-600 font-bold">{{ isExpanded('spell-' + spell.name) ? '−' : '+' }}</span>
                      </div>
                    </button>

                    <!-- Basic Info (always visible) -->
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
                      @if (spell.entity?.time?.length) {
                        <div class="text-sm text-gray-600">Time: {{ helpers.spellTimeLabel(spell.entity?.time ?? []) }}</div>
                      }
                      @if (spell.entity?.range) {
                        <div class="text-sm text-gray-600">Range: {{ helpers.spellRangeLabel(spell.entity?.range ?? null) }}</div>
                      }
                      @if (spell.entity?.components) {
                        <div class="text-sm text-gray-600">Components: {{ helpers.spellComponentsLabel(spell.entity?.components ?? null) }}</div>
                      }
                      @if (spell.entity?.duration?.length) {
                        <div class="text-sm text-gray-600">Duration: {{ helpers.spellDurationLabel(spell.entity?.duration ?? []) }}</div>
                      }
                    </div>

                    <!-- Source Tags -->
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      @if (spell.source) {
                        <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{{ spell.source }}</span>
                      }
                      @if (spell.castingSourceName) {
                        <span class="text-xs bg-mist-100 text-mist-700 px-2 py-0.5 rounded">{{ spell.castingSourceName }}</span>
                      }
                    </div>

                    <!-- Expandable Content -->
                    @if (isExpanded('spell-' + spell.name)) {
                      <div class="mt-3 pt-3 border-t border-gray-200">
                        @if (spell.entity?.entries?.length) {
                          <div>
                            <app-entry-renderer [entries]="spell.entity?.entries ?? []"></app-entry-renderer>
                          </div>
                        }
                        @if (spell.entity?.entriesHigherLevel?.length) {
                          <div class="mt-3 border-t border-gray-200 pt-3">
                            <div class="text-sm font-semibold text-gray-700">At Higher Levels</div>
                            @for (higher of spell.entity?.entriesHigherLevel ?? []; track $index) {
                              @if (higher.entries?.length) {
                                <app-entry-renderer [entries]="higher.entries ?? []"></app-entry-renderer>
                              }
                            }
                          </div>
                        }

                      </div>
                    }
                        @if (spell.uses?.length) {
                          <div class="mt-4 border-t border-gray-200 pt-4">
                            @for (use of spell.uses; track use.tag) {
                              <app-feature-uses 
                                [uses]="use"
                                (usesUpdated)="updateSpellUses(spell, $event)"
                              />
                            }
                          </div>
                        }
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <p class="text-gray-500 italic">No spells known</p>
        }
      </div>
    </div>
  `,
})
export class SpellsPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  helpers = inject(CharacterHelpersService);
  
  highlightedId = signal<string | null>(null);

  spellListTypeFilter = signal<'PREPARED' | 'KNOWN' | 'SPELLBOOK'>('PREPARED');
  spellCastingSourceFilter = signal<string>('ALL');
  expandedItems = signal<Set<string>>(new Set());

  character = computed(() => this.characterData()?.character ?? null);
  featureSourceStats = computed(() => this.buildFeatureSourceStats());

  spellListTypes = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const useSpellbook = this.character()?.featureSources?.some((fs) => fs.useSpellbook) ?? false;
    const types = new Set(spells.map((spell) => spell.listType).filter(Boolean) as string[]);
    const result: Array<'PREPARED' | 'KNOWN' | 'SPELLBOOK'> = [...Array.from(types)] as any;
    return useSpellbook ? result : result.filter((t) => t !== 'SPELLBOOK');
  });

  spellCastingSourcesList = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const sources = new Set(spells.map((spell) => spell.castingSourceName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(sources).sort()];
  });

  spellSlotGroups = computed(() => {
    const spellSlots = this.character()?.spellSlots ?? {};
    return Object.entries(spellSlots)
      .map(([source, slots]) => ({
        source,
        slots: [...slots].sort((a, b) => a.level - b.level),
      }))
      .sort((a, b) => a.source.localeCompare(b.source));
  });

  spells = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const listTypeFilter = this.spellListTypeFilter();
    const sourceFilter = this.spellCastingSourceFilter();
    const filtered = spells.filter((spell) => {
      const matchesListType = spell.listType === listTypeFilter;
      const matchesSource = sourceFilter === 'ALL' || spell.castingSourceName === sourceFilter;
      return matchesListType && matchesSource;
    });
    return [...filtered].sort((a, b) => {
      // Sort by casting source first
      const sourceA = a.castingSourceName ?? '';
      const sourceB = b.castingSourceName ?? '';
      if (sourceA !== sourceB) return sourceA.localeCompare(sourceB);
      // Then by level
      const levelA = a.entity?.level ?? 0;
      const levelB = b.entity?.level ?? 0;
      if (levelA !== levelB) return levelA - levelB;
      // Then by name
      return a.name.localeCompare(b.name);
    });
  });

  spellsByLevel = computed(() => {
    const spells = this.spells();
    const grouped = new Map<number, any[]>();

    for (const spell of spells) {
      const level = spell.entity?.level ?? 0;
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      grouped.get(level)!.push(spell);
    }

    return Array.from(grouped.entries())
      .map(([level, spells]) => ({ level, spells }))
      .sort((a, b) => a.level - b.level);
  });

  constructor() {
    // Handle scroll/highlight on navigation
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

  spellLevelHeader(level: number): string {
    return level === 0 ? 'Cantrips' : `Level ${level}`;
  }

  private buildFeatureSourceStats() {
    const character = this.character();
    const sources = character?.featureSources?.filter((source) => source.isSpellcastingSource) ?? [];
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

  private spellSlotUsedOverrides = signal<Record<string, number>>({});

  spellSlotIndexes(total: number) {
    return Array.from({ length: total }, (_, i) => i);
  }

  spellSlotKey(source: string, level: number) {
    return `${source}::${level}`;
  }

  spellSlotUsed(source: string, slot: { level: number; used: number }) {
    const key = this.spellSlotKey(source, slot.level);
    const overrides = this.spellSlotUsedOverrides();
    return overrides[key] ?? slot.used ?? 0;
  }

  spellSlotProgress(source: string, slot: { level: number; total: number; used: number }) {
    const total = slot.total ?? 0;
    if (total <= 0) return 0;
    return (this.spellSlotUsed(source, slot) / total) * 100;
  }

  toggleSpellSlot(source: string, slot: { level: number; total: number; used: number }, index: number) {
    const currentUsed = this.spellSlotUsed(source, slot);
    const isCurrentlyUsed = index < currentUsed;
    const newUsed = isCurrentlyUsed ? index : index + 1;
    const key = this.spellSlotKey(source, slot.level);

    slot.used = newUsed;
    this.spellSlotUsedOverrides.update((prev) => ({
      ...prev,
      [key]: newUsed,
    }));
  }

  addOneSpellSlot(source: string, slot: { level: number; total: number; used: number }) {
    const currentUsed = this.spellSlotUsed(source, slot);
    const newUsed = Math.min(currentUsed + 1, slot.total);
    const key = this.spellSlotKey(source, slot.level);

    slot.used = newUsed;
    this.spellSlotUsedOverrides.update((prev) => ({
      ...prev,
      [key]: newUsed,
    }));
  }

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

  updateSpellUses(spell: any, event: { usedFreeUses: number; tag?: string }) {
    // Find the matching use entry and update it
    if (spell.uses) {
      const useEntry = spell.uses.find((u: any) => u.tag === event.tag);
      if (useEntry) {
        useEntry.usedFreeUses = event.usedFreeUses;
      }
    }
  }
}
