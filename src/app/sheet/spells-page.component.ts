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
        background-color: rgba(219, 186, 255, 0.5);
        box-shadow: 0 0 0 0 rgba(219, 186, 255, 0.8);
      }
      40% {
        background-color: rgba(219, 186, 255, 0.25);
        box-shadow: 0 0 0 8px rgba(219, 186, 255, 0.2);
        border-color: rgb(219, 186, 255);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(219, 186, 255, 0);
      }
    }
  `],
  template: `
    <div class="bg-surface-container-highest p-8 rounded-lg border-2 border-outline shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Spellcasting</h2>
      @if (spellSlotGroups().length > 0) {
          <h3 class="text-xl font-bold mb-3">Spell Slots</h3>
          <div class="space-y-4">
            @for (group of spellSlotGroups(); track group.source) {
              <div class="border border-surface border-2 rounded-lg p-3 bg-surface-container">
                <div class="text-sm font-semibold text-on-surface mb-3">{{ group.source }}</div>
                <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  @for (slot of group.slots; track slot.level) {
                    <div 
                      class="border border-surface border-2 rounded-md p-3 bg-surface-container-high cursor-pointer hover:bg-surface-container-high transition-colors"
                      (click)="addOneSpellSlot(group.source, slot)"
                    >
                      <div class="flex items-center justify-between text-sm font-semibold text-on-surface-container-high mb-2">
                        <span>Level {{ slot.level }}</span>
                        <span>{{ slot.total-spellSlotUsed(group.source, slot) }} / {{ slot.total }}</span>
                      </div>
                      <div class="w-full bg-outline-variant rounded-full h-2 mb-3">
                        <div
                          class="bg-purple h-2 rounded-full transition-all"
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
                                class="w-4 h-4 text-purple on-surface-container-high border-surface-container-high rounded focus:ring-2 focus:ring-purple accent-purple"
                              />
                              <span class="ml-1 text-sm text-on-surface-container-high">{{ index + 1 }}</span>
                            </label>
                          }
                        </div>
                      } @else {
                        <p class="text-xs text-on-surface-container-high italic">No slots available</p>
                      }
                      @if (slot.regainCondition) {
                        <div class="text-xs text-on-surface-container-high mt-2" (click)="$event.stopPropagation()">Regain: {{ slot.regainCondition }}</div>
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
        <span class="text-sm font-semibold text-on-surface">List Type:</span>
        @for (type of spellListTypes(); track type) {
          <button
            type="button"
            class="px-3 py-1 text-sm border rounded-full"
            [class.bg-purple]="spellListTypeFilter() === type"
            [class.text-on-purple]="spellListTypeFilter() === type"
            [class.border-purple]="spellListTypeFilter() === type"
            [class.border-outline-variant]="spellListTypeFilter() !== type"
            (click)="spellListTypeFilter.set(type)"
          >
            {{ type }}
          </button>
        }
      </div>
      <div class="mb-6">
        <div class="mb-3">
          <span class="text-sm font-semibold text-on-surface">Casting Source:</span>
        </div>
        @if (featureSourceStats().length > 0) {
          <div class="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
            <button
              type="button"
              class="text-center border-2 rounded-lg p-3 transition-colors"
              [class.bg-purple-container]="spellCastingSourceFilter() === 'ALL'"
              [class.border-purple]="spellCastingSourceFilter() === 'ALL'"
              [class.text-on-purple-container]="spellCastingSourceFilter() === 'ALL'"
              [class.bg-surface-container]="spellCastingSourceFilter() !== 'ALL'"
              [class.border-outline-variant]="spellCastingSourceFilter() !== 'ALL'"
              [class.text-on-surface]="spellCastingSourceFilter() !== 'ALL'"
              (click)="spellCastingSourceFilter.set('ALL')"
            >
              <div class="text-sm font-semibold">ALL</div>
            </button>
            @for (source of featureSourceStats(); track source.name) {
              <button
                type="button"
                class="text-center border-2 rounded-lg p-3 transition-colors wrap-break-word"
                [class.bg-purple-container]="spellCastingSourceFilter() === source.name"
                [class.border-purple]="spellCastingSourceFilter() === source.name"
                [class.bg-surface-container]="spellCastingSourceFilter() !== source.name"
                [class.border-outline-variant]="spellCastingSourceFilter() !== source.name"
                (click)="spellCastingSourceFilter.set(source.name)"
              >
                <div class="text-sm font-semibold over" [class.text-on-purple-container]="spellCastingSourceFilter() === source.name" [class.text-on-surface]="spellCastingSourceFilter() !== source.name">{{ source.name }}</div>
                <div class="mt-2 grid gap-2">
                  @for (stat of source.abilities; track stat.ability) {
                      <div class="flex flex-wrap items-center gap-2 text-sm justify-center" [class.text-on-blue-container]="spellCastingSourceFilter() === source.name" [class.text-on-surface-variant]="spellCastingSourceFilter() !== source.name">
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
      <div class="space-y-6">
        @if (spellsByLevel().length > 0) {
          @for (levelGroup of spellsByLevel(); track levelGroup.level) {
            <div>
              <h4 class="text-lg font-bold text-purple mb-3 border-b-2 border-purple pb-1">
                {{ spellLevelHeader(levelGroup.level) }}
              </h4>
              <div class="space-y-4">
                @for (spell of levelGroup.spells; track spell.name) {
                  <div class="border-2 border-purple rounded-lg p-4 bg-surface-container" [attr.id]="'spell-' + helpers.sourceId(spell.name + '-' + (spell.source ?? ''))" [class.flash-highlight]="highlightedId() === ('spell-' + helpers.sourceId(spell.name + '-' + (spell.source ?? '')))">
                    <!-- Header (always visible, clickable) -->
                    <button
                      type="button"
                      class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2"
                      (click)="toggleExpanded('spell-' + spell.name)"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 w-full">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-xl font-bold text-purple">{{ spell.name }}</h3>
                          @if (spell.entity?.level !== undefined) {
                            <span class="text-xs bg-purple-container text-on-purple-container px-2 py-0.5 rounded">{{ helpers.spellLevelLabel(spell) }}</span>
                          }
                          @if (spell.entity?.school) {
                            <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded">{{ helpers.spellSchoolLabel(spell.entity?.school ?? '') }}</span>
                          }
                          @if (spell.entity?.meta?.ritual) {
                            <span class="text-xs bg-green-container text-on-green-container px-2 py-0.5 rounded">Ritual</span>
                          }
                          <!-- Interactive List Type Tags -->
                          <div class="flex gap-1 flex-wrap">
                            @for (type of availableListTypes(); track type) {
                              @if (type === 'PREPARED') {
                                <button
                                  type="button"
                                  (click)="togglePreparedSpell(spell, $event)"
                                  [class.bg-blue-container]="hasSpellListType(spell, type)"
                                  [class.text-on-blue-container]="hasSpellListType(spell, type)"
                                  [class.bg-blue]="!hasSpellListType(spell, type)"
                                  [class.text-on-blue]="!hasSpellListType(spell, type)"
                                  class="text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  {{ determineIconForSpell(spell) + " " + type }}
                                </button>
                              } @else {
                                <span
                                  [class.bg-blue-container]="hasSpellListType(spell, type)"
                                  [class.text-on-blue-container]="hasSpellListType(spell, type)"
                                  [class.bg-blue]="!hasSpellListType(spell, type)"
                                  [class.text-on-blue]="!hasSpellListType(spell, type)"
                                  class="text-xs px-2 py-0.5 rounded"
                                >
                                  {{ type }}
                                </span>
                              }
                            }
                          </div>
                        </div>
                        <span class="text-xl text-purple font-bold">{{ isExpanded('spell-' + spell.name) ? '−' : '+' }}</span>
                      </div>
                    </button>

                    <!-- Basic Info (always visible) -->
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
                      @if (spell.entity?.time?.length) {
                        <div class="text-sm text-on-surface-container">Time: {{ helpers.spellTimeLabel(spell.entity?.time ?? []) }}</div>
                      }
                      @if (spell.entity?.range) {
                        <div class="text-sm text-on-surface-container">Range: {{ helpers.spellRangeLabel(spell.entity?.range ?? null) }}</div>
                      }
                      @if (spell.entity?.components) {
                        <div class="text-sm text-on-surface-container">Components: {{ helpers.spellComponentsLabel(spell.entity?.components ?? null) }}</div>
                      }
                      @if (spell.entity?.duration?.length) {
                        <div class="text-sm text-on-surface-container">Duration: {{ helpers.spellDurationLabel(spell.entity?.duration ?? []) }}</div>
                      }
                    </div>

                    <!-- Source Tags -->
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      @if (spell.source) {
                        <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ spell.source }}</span>
                      }
                      @if (spell.castingSourceName) {
                        <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ spell.castingSourceName }}</span>
                      }
                    </div>

                    <!-- Expandable Content -->
                    @if (isExpanded('spell-' + spell.name)) {
                      <div class="mt-3 pt-3 border-t border-outline-variant">
                        @if (spell.entity?.entries?.length) {
                          <div>
                            <app-entry-renderer [entries]="spell.entity?.entries ?? []"></app-entry-renderer>
                          </div>
                        }
                        @if (spell.entity?.entriesHigherLevel?.length) {
                          <div class="mt-3 border-t border-outline-variant pt-3">
                            <div class="text-sm font-semibold text-on-surface">At Higher Levels</div>
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
                          <div class="mt-4 border-t border-outline-variant pt-4">
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
          <p class="text-on-surface-variant italic">No spells known</p>
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

    // Clear spell slot overrides when character data updates (e.g., after rest)
    effect(() => {
      this.characterData();
      this.spellSlotUsedOverrides.set({});
    });
  }

  private spellKey(spell: any): string {
    return spell.name + ':' + (spell.source ?? '');
  }

  getSpellListTypes(spell: any): string[] {
    const allSpells = this.characterData()?.spells ?? [];
    const key = this.spellKey(spell);
    const matching = allSpells.filter((s) => this.spellKey(s) === key);
    return matching.map((s) => s.listType).filter(Boolean) as string[];
  }

  hasSpellListType(spell: any, listType: string): boolean {
    return this.getSpellListTypes(spell).includes(listType);
  }

  togglePreparedSpell(spell: any, event: Event) {
    event.stopPropagation();
    
    const allSpells = this.characterData()?.spells ?? [];
    const key = this.spellKey(spell);
    const isPrepared = this.hasSpellListType(spell, 'PREPARED');
    if (this.hasUses(spell)) {
      return; // Don't allow toggling if the spell has uses (e.g., limited daily casts)
    }
    if (isPrepared) {
      // Remove the PREPARED version
      const index = allSpells.findIndex((s) => this.spellKey(s) === key && s.listType === 'PREPARED');
      if (index >= 0) {
        allSpells.splice(index, 1);
      }
    } else {
      // Add a PREPARED version by copying the current spell
      const preparedSpell = { ...spell, listType: 'PREPARED' };
      allSpells.push(preparedSpell);
    }
    
    // Update the store
    const character = this.characterData();
    if (character) {
      const updated = { ...character, spells: [...allSpells] };
      this.store.setCharacter(updated);
    }
  }

  availableListTypes = computed(() => {
    const useSpellbook = this.character()?.featureSources?.some((fs) => fs.useSpellbook) ?? false;
    const types: Array<'KNOWN' | 'SPELLBOOK' | 'PREPARED'> = ['KNOWN'];
    if (useSpellbook) {
      types.push('SPELLBOOK');
    }
    types.push('PREPARED');
    return types;
  });

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

  hasUses(spell: any): boolean {
    return spell.uses !== undefined && spell.uses.length > 0;
  }

  determineIconForSpell(spell: any): string {
    if (this.hasUses(spell)) {
      return '🔒';
    }
    if (this.hasSpellListType(spell, 'PREPARED')) {
      return '-';
    } else {
      return '+'
    }
  }
}
