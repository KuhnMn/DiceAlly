import { Component, inject, computed, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-spells-page',
  imports: [CommonModule, EntryRendererComponent],
  template: `
    <div class="bg-white p-8 rounded-lg border-2 border-gray-300 shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Spellcasting</h2>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap items-center gap-2">
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
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-gray-700">Casting Source:</span>
          @for (source of spellCastingSourcesList(); track source) {
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded-full"
              [class.bg-purple-600]="spellCastingSourceFilter() === source"
              [class.text-white]="spellCastingSourceFilter() === source"
              [class.border-purple-600]="spellCastingSourceFilter() === source"
              [class.border-gray-300]="spellCastingSourceFilter() !== source"
              (click)="spellCastingSourceFilter.set(source)"
            >
              {{ source }}
            </button>
          }
        </div>
      </div>
      <div class="space-y-4">
        @if (spells().length > 0) {
          @for (spell of spells(); track spell.name) {
            <div class="border-2 border-gray-300 rounded-lg p-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-xl font-bold text-purple-800">{{ spell.name }}</h3>
                @if (spell.entity?.level !== undefined) {
                  <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{{ helpers.spellLevelLabel(spell) }}</span>
                }
                @if (spell.entity?.school) {
                  <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{{ helpers.spellSchoolLabel(spell.entity?.school ?? '') }}</span>
                }
                @if (spell.listType) {
                  <span class="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">{{ spell.listType }}</span>
                }
              </div>
              <div class="text-sm text-gray-600 space-y-1 mt-2">
                @if (spell.source) {
                  <div>Source: {{ spell.source }}</div>
                }
                @if (spell.castingSourceName) {
                  <div>Casting Source: {{ spell.castingSourceName }}</div>
                }
                @if (spell.entity?.time?.length) {
                  <div>Time: {{ helpers.spellTimeLabel(spell.entity?.time ?? []) }}</div>
                }
                @if (spell.entity?.range) {
                  <div>Range: {{ helpers.spellRangeLabel(spell.entity?.range ?? null) }}</div>
                }
                @if (spell.entity?.components) {
                  <div>Components: {{ helpers.spellComponentsLabel(spell.entity?.components ?? null) }}</div>
                }
                @if (spell.entity?.duration?.length) {
                  <div>Duration: {{ helpers.spellDurationLabel(spell.entity?.duration ?? []) }}</div>
                }
              </div>
              @if (spell.entity?.entries?.length) {
                <div class="mt-3">
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
        } @else {
          <p class="text-gray-500 italic">No spells known</p>
        }
      </div>
    </div>
  `,
})
export class SpellsPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);

  spellListTypeFilter = signal<'ALL' | 'PREPARED' | 'KNOWN' | 'SPELLBOOK'>('PREPARED');
  spellCastingSourceFilter = signal<string>('ALL');

  character = computed(() => this.characterData()?.character ?? null);

  spellListTypes = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const useSpellbook = this.character()?.featureSources?.some((fs) => fs.useSpellbook) ?? false;
    const types = new Set(spells.map((spell) => spell.listType).filter(Boolean) as string[]);
    const result: Array<'ALL' | 'PREPARED' | 'KNOWN' | 'SPELLBOOK'> = ['ALL', ...Array.from(types)] as any;
    return useSpellbook ? result : result.filter((t) => t !== 'SPELLBOOK');
  });

  spellCastingSourcesList = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const sources = new Set(spells.map((spell) => spell.castingSourceName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(sources).sort()];
  });

  spells = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const listTypeFilter = this.spellListTypeFilter();
    const sourceFilter = this.spellCastingSourceFilter();
    const filtered = spells.filter((spell) => {
      const matchesListType = listTypeFilter === 'ALL' || spell.listType === listTypeFilter;
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
}
