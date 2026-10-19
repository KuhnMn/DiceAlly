import { compareSearchMatches } from '../search-ranking';
import { SpellViewSwitcherComponent } from '../spell-view-switcher.component';
import { SpellSchoolFilterComponent } from '../spell-school-filter.component';
import { SpellSchool, matchesSpellSchool, shortSpellSchoolLabel, spellSourceCounts } from '../editor/spell-selection';
import { SpellCastingTimeFilterComponent } from '../spell-casting-time-filter.component';
import { SpellCastingTime, matchesCastingTime, spellListLabel, copySpellToList, preparationLocked, spellIdentity } from '../editor/spell-selection';
import { ListControlsComponent } from '../list-controls.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { RecoveryIndicatorComponent } from '../recovery-indicator.component';
import { SpellDetailsComponent } from './spell-details.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { SpellSummaryComponent } from './spell-summary.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetSourcePickerComponent } from './sheet-source-picker.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
import { Component, inject, computed, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter, FeatureNotes } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { AppDialogService } from '../services/app-dialog.service';

type SpellBonusItemOverview = {
  key: string;
  name: string;
  source: string | undefined;
  bonusesText: string;
};

type SpellRitualFilter = 'ALL' | 'RITUAL' | 'NON_RITUAL';
type SpellLevelFilter = 'ALL' | number;

@Component({
  selector: 'app-spells-page',
  host: { class: 'block w-full min-w-0 max-w-full' },
  imports: [SpellSchoolFilterComponent, SpellViewSwitcherComponent, SpellCastingTimeFilterComponent, ListControlsComponent, SheetListLayoutComponent, RecoveryIndicatorComponent, SpellDetailsComponent, SheetDetailDialogComponent, UiIconComponent, SheetSourcePickerComponent, HorizontalRowDirective, SpellSummaryComponent, CommonModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent],
  styles: [`
    .spell-page-header app-spell-view-switcher { margin-bottom: 0; }
    .spell-page.spell-preparation-view { padding: .75rem; }
    @media (min-width: 640px) { .spell-page.spell-preparation-view { padding: 1.25rem; } }
    .preparation-card { padding: .375rem .5rem; border: 0; border-radius: 0; background: transparent; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
    .preparation-card:last-child { border-bottom: 0; }
    .preparation-list { gap: 0; overflow: hidden; border-radius: .5rem; background: var(--md-sys-color-surface-container); }
    .compact-preparation-toggle { display: flex; align-self: stretch; width: 2.75rem; height: auto; gap: .125rem; padding: 0; border-radius: 9999px; font-size: 1rem; }
    .normal-preparation-toggle { display: inline-flex; min-width: 1.75rem; height: 1.25rem; gap: .125rem; padding: 0 .25rem; font-size: 1rem; }
    .spell-preparation-view .preparation-name { font-size: .875rem; color: var(--md-sys-color-on-surface); }
    .spell-preparation-view .preparation-metadata { font-size: .6875rem; }
    .spell-preparation-view .preparation-level { font-size: .8125rem; margin-bottom: .25rem; padding-bottom: .125rem; border-bottom-width: 1px; }
    .spell-preparation-view .preparation-groups > :not([hidden]) ~ :not([hidden]) { margin-top: .75rem; }

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
    <ng-template #prepareControl let-spell let-compact="compact">
      @let prepared = hasSpellListType(spell, 'PREPARED');
      @let locked = isPreparationLocked(spell);
      <button type="button" (click)="togglePreparedSpell(spell, $event)" [disabled]="locked" [attr.aria-pressed]="prepared"
        [attr.aria-label]="locked ? spell.name + (prepared ? ' is prepared and cannot be unprepared because it has use trackers' : ' preparation is locked because it has use trackers') : (prepared ? 'Unprepare ' : 'Prepare ') + spell.name"
        [title]="locked ? 'Preparation is locked because this spell has use trackers.' : prepared ? 'Prepared: click to unprepare' : 'Click to prepare this spell'"
        [class.bg-blue-container]="prepared" [class.text-on-blue-container]="prepared" [class.border-blue]="prepared" [class.bg-surface-container]="!prepared" [class.border-outline-variant]="!prepared"
        [class.compact-preparation-toggle]="compact" [class.normal-preparation-toggle]="!compact" class="shrink-0 items-center px-2 py-1 justify-center rounded-full border text-xs disabled:opacity-60">
        <app-ui-icon [name]="locked ? 'lock' : 'clipboard-check'" />
        @if (!locked) { <app-ui-icon [name]="prepared ? 'close' : 'plus'" class="text-xs" /> }

      </button>
    </ng-template>
    <div class="spell-page min-w-0 max-w-full bg-surface-container-highest p-3 sm:p-5 rounded-lg border-2 border-outline shadow-lg [overflow-wrap:anywhere]" [class.spell-preparation-view]="spellView() !== 'PREPARED'" [attr.data-spell-view]="spellView()">
      <div class="spell-page-header mb-3 flex items-center justify-between gap-2">
        <app-spell-view-switcher class="min-w-0 flex-1" preparedHeading="Spellcasting" [view]="spellView()" (viewChange)="spellView.set($event)" [showSpellbook]="showSpellbook()" />
        <app-sheet-list-layout #listLayout class="sm:ml-2 sm:border-l sm:border-outline-variant sm:pl-4" />
      </div>

      @if (spellView() === 'PREPARED' && spellSlotGroups().length > 0) {
        <div id="preparation-spell-slots">
          <h3 class="mb-2 text-xl font-bold sm:mb-3">Spell Slots</h3>
          <div class="space-y-2">
            @for (group of spellSlotGroups(); track group.source) {
              <div class="border border-surface border-2 rounded-lg p-2 bg-surface-container">
                <div class="text-sm font-semibold text-on-surface mb-1.5">{{ group.source }}</div>
                <div appHorizontalRow class="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
                  @for (slot of group.slots; track slot.level) {
                    <div 
                      class="max-sm:w-44 border-2 border-surface rounded-md px-2 py-1 bg-surface-container-high"

                    >
                      <div class="flex items-center justify-between gap-2 text-sm font-semibold text-on-surface-container-high mb-0.5 sm:mb-1">
                        <span>Level {{ slot.level }}</span>
                        <span class="ml-auto whitespace-nowrap">{{ slot.total-spellSlotUsed(group.source, slot) }} / {{ slot.total }}</span>
                        <app-recovery-indicator [condition]="slot.regainCondition" />
                      </div>
                      <div class="hidden sm:block w-full bg-outline-variant rounded-full h-1 mb-0.5">
                        <div
                          class="bg-purple h-full rounded-full transition-all"
                          [style.width.%]="spellSlotProgress(group.source, slot)"
                        ></div>
                      </div>
                      @if (slot.total > 0) {
                        <div class="flex flex-wrap gap-0">
                          @for (index of spellSlotIndexes(slot.total); track index) {
                            <label class="flex min-h-8 min-w-9 items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                [attr.aria-label]="group.source + ' level ' + slot.level + ' slot ' + (index + 1) + ' used'"
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

                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <section class="mt-4 min-w-0" aria-label="Spells">
      @if (spellView() === 'PREPARED') { <h3 class="mb-2 text-lg font-bold">Prepared Spells</h3> }
      <div class="mb-3">
        @if (characterData()?.character; as character) {
          <app-feature-source-picker [character]="character" [sources]="pickerSources()"
            heading="Casting Source" tone="spells" [showManage]="false"
            [spellCounts]="spellView() === 'PREPARED' ? null : sourceSpellCounts()" [showStats]="spellView() === 'PREPARED'"
            [value]="spellCastingSourceFilter()" [orphanNames]="spellCastingSourcesList().slice(1)"
            (selected)="spellCastingSourceFilter.set($event)" />
        }
      </div>
      @if (spellView() === 'PREPARED' && spellBonusItemsOverview().length > 0) {
        <div class="mb-3 mt-2 p-2 border border-tertiary rounded-lg bg-tertiary-container">
          <div class="text-xs font-semibold text-on-tertiary-container mb-2">Item Spell Bonuses</div>
          <div class="space-y-1">
            @for (entry of spellBonusItemsOverview(); track entry.key) {
              <div class="text-xs text-on-tertiary-container">
                <span class="font-semibold">{{ entry.name }}</span>
                @if (entry.source) {
                  <span class="opacity-80"> ({{ entry.source }})</span>
                }
                <span class="ml-1">- {{ entry.bonusesText }}</span>
              </div>
            }
          </div>
        </div>
      }
      <app-list-controls label="Search spells" [query]="searchQuery()" (queryChange)="searchQuery.set($event)"
        [filterCount]="activeFilterCount()" (cleared)="clearFilters()">
      <ng-container list-toolbar-action>
        @if (spellView() === 'SPELLBOOK') {
          <button type="button" aria-label="Only ritual spells" title="Only ritual spells" [attr.aria-pressed]="spellRitualFilter() === 'RITUAL'"
            (click)="spellRitualFilter.set(spellRitualFilter() === 'RITUAL' ? 'ALL' : 'RITUAL')"
            [class.bg-green-container]="spellRitualFilter() === 'RITUAL'" [class.text-on-green-container]="spellRitualFilter() === 'RITUAL'"
            class="min-h-11 shrink-0 rounded-lg border border-outline-variant px-2 text-xs">Ritual</button>
        }
      </ng-container>
      <div appHorizontalRow class="mb-2 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-on-surface">Spell Level:</span>
        @for (levelFilter of spellLevelFilterOptions(); track levelFilter.value) {
          <button
            type="button"
            class="min-h-11 px-3 py-1 text-sm border rounded-full"
            [class.bg-purple]="isSpellLevelSelected(levelFilter.value)"
            [attr.aria-pressed]="isSpellLevelSelected(levelFilter.value)"
            [class.text-on-purple]="isSpellLevelSelected(levelFilter.value)"
            [class.border-purple]="isSpellLevelSelected(levelFilter.value)"
            [class.border-outline-variant]="!isSpellLevelSelected(levelFilter.value)"
            [class.bg-surface-container]="!isSpellLevelSelected(levelFilter.value)"
            [class.text-on-surface]="!isSpellLevelSelected(levelFilter.value)"
            (click)="toggleSpellLevel(levelFilter.value)"
          >
            {{ levelFilter.label }}
          </button>
        }
      </div>
      <app-spell-casting-time-filter [selected]="spellCastingTimes()" (selectedChange)="spellCastingTimes.set($event)" />
      <app-spell-school-filter [selected]="spellSchools()" (selectedChange)="spellSchools.set($event)" />
      <div appHorizontalRow class="mb-2 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-on-surface">Rituals:</span>
        <button
          type="button"
          class="min-h-11 px-3 py-1 text-sm border rounded-full transition-colors"
          [class.bg-green-container]="spellRitualFilter() === 'RITUAL'"
          [class.text-on-green-container]="spellRitualFilter() === 'RITUAL'"
          [class.border-green]="spellRitualFilter() === 'RITUAL'"
          [class.bg-surface-container]="spellRitualFilter() === 'ALL'"
          [class.text-on-surface]="spellRitualFilter() === 'ALL'"
          [class.border-outline-variant]="spellRitualFilter() === 'ALL'"
          [class.bg-rose-container]="spellRitualFilter() === 'NON_RITUAL'"
          [class.text-on-rose-container]="spellRitualFilter() === 'NON_RITUAL'"
          [class.border-rose]="spellRitualFilter() === 'NON_RITUAL'"
          (click)="cycleSpellRitualFilter()"
        >
          {{ spellRitualFilterLabel() }}
        </button>
      </div>
      </app-list-controls>
      <div class="preparation-groups space-y-4 sm:space-y-6">
        @if (spellsByLevel().length > 0) {
          @for (levelGroup of spellsByLevel(); track levelGroup.level) {
            <div>
              <h4 class="preparation-level text-lg font-bold text-purple mb-3 border-b-2 border-purple pb-1">
                {{ spellLevelHeader(levelGroup.level) }}
              </h4>
              <div class="sheet-entry-list" [class.preparation-list]="spellView() !== 'PREPARED'" [class.sheet-entry-list-two-columns]="listLayout.columns() === 2" [class.sheet-entry-list-three-columns]="listLayout.columns() === 3">
                @for (spell of levelGroup.spells; track spell) {
                  <div class="min-w-0 border-2 border-purple rounded-lg px-3 py-1.5 sm:py-2 bg-surface-container" [attr.id]="'spell-' + (spell.editorId ?? helpers.sourceId(spell.name + '-' + (spell.source ?? '')))" [class.preparation-card]="spellView() !== 'PREPARED'" [class.flash-highlight]="highlightedId() === ('spell-' + (spell.editorId ?? helpers.sourceId(spell.name + '-' + (spell.source ?? ''))))">
                    @if (spellView() !== 'PREPARED') {
                      <div class="flex min-w-0 items-stretch gap-2">
                        <div class="relative min-w-0 flex-1 pr-8">
                      <div class="flex min-w-0 items-center gap-1">
                        <h3 class="min-w-0 flex-1">
                          <button type="button" (click)="toggleExpanded(spellExpansionId(spell))" aria-haspopup="dialog" [attr.aria-expanded]="isExpanded(spellExpansionId(spell))" [title]="spell.name"
                            class="preparation-name flex min-h-6 w-full min-w-0 items-center gap-1 rounded text-left text-xs font-semibold text-purple after:absolute after:inset-0 after:rounded focus-visible:outline-2 focus-visible:outline-primary">
                            <span class="min-w-0 flex-1 truncate">{{ spell.name }}</span>
                            <span class="absolute inset-y-0 right-0 flex w-7 items-center justify-center rounded text-base text-on-surface-variant hover:bg-surface-container-high"><app-ui-icon name="chevron" /></span>
                          </button>
                        </h3>
                      </div>
                      <div class="preparation-metadata mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-4">
                        @if (spell.entity?.school; as school) { <span class="shrink-0 rounded bg-teal-container px-1 text-on-teal-container" [attr.aria-label]="helpers.spellSchoolLabel(school)" [title]="helpers.spellSchoolLabel(school)">{{ compactSchoolLabel(school) }}</span> }
                        @if (hasSpellListType(spell, 'SPELLBOOK')) { <span role="img" aria-label="In Spellbook" title="In Spellbook" class="inline-flex shrink-0 rounded bg-purple-container px-0.5 text-xs text-on-purple-container"><app-ui-icon name="book" /></span> }
                        @if (spellView() === 'SPELLBOOK') {
                          @if (spell.entity?.meta?.ritual) { <span class="shrink-0 rounded bg-green-container px-1 text-on-green-container" aria-label="Ritual" title="Ritual">Ritual</span> }
                          @if (requiresConcentration(spell)) { <span class="shrink-0 rounded bg-tertiary-container px-1 text-on-tertiary-container" aria-label="Concentration" title="Concentration">C</span> }
                        }
                        @if (spell.castingSourceName) { <span class="min-w-0 truncate rounded bg-secondary-container px-1 text-on-secondary-container" [title]="spell.castingSourceName">{{ spell.castingSourceName }}</span> }
                        @if (spell.source) { <span class="min-w-0 max-w-[35%] truncate rounded bg-surface-container-highest px-1 text-on-surface" [title]="spell.source">{{ spell.source }}</span> }
                      </div>
                        </div>
                        <ng-container [ngTemplateOutlet]="prepareControl" [ngTemplateOutletContext]="{ $implicit: spell, compact: true }" />
                      </div>
                    } @else {
                    <h3>
                      <button type="button" (click)="toggleExpanded(spellExpansionId(spell))" aria-haspopup="dialog" [attr.aria-expanded]="isExpanded(spellExpansionId(spell))" class="flex min-h-8 w-full items-center justify-between gap-2 rounded text-left text-base font-bold text-purple sm:gap-3 sm:text-xl focus-visible:outline-2 focus-visible:outline-primary">
                        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"><span class="min-w-0 break-words [overflow-wrap:anywhere]">{{ spell.name }}</span>
                        @if (spell.entity?.level !== undefined) { <span class="shrink-0 whitespace-nowrap rounded bg-purple-container px-2 py-0.5 text-xs font-normal text-on-purple-container">{{ helpers.spellLevelLabel(spell) }}</span> }
                        </span><app-ui-icon class="shrink-0" name="chevron" />
                      </button>
                    </h3>
                    <div class="flex flex-wrap items-center gap-1 sm:gap-2">
                      @if (spellView() === 'PREPARED') {
                        @if (spell.entity?.school) { <span class="rounded bg-teal-container px-2 py-0.5 text-xs text-on-teal-container">{{ helpers.spellSchoolLabel(spell.entity?.school ?? '') }}</span> }
                        @if (spell.entity?.meta?.ritual) { <span class="rounded bg-green-container px-2 py-0.5 text-xs text-on-green-container">Ritual</span> }
                        @if (requiresConcentration(spell)) { <span class="rounded bg-tertiary-container px-2 py-0.5 text-xs text-on-tertiary-container" title="Concentration" aria-label="Concentration">C</span> }
                      }
                      @for (type of listTypesForSpell(spell); track type) {
                        @if (type === 'PREPARED') {
                          <ng-container [ngTemplateOutlet]="prepareControl" [ngTemplateOutletContext]="{ $implicit: spell, compact: false }" />
                        } @else if (type === 'SPELLBOOK' && hasSpellListType(spell, type)) {
                          <span role="img" [attr.aria-label]="'In ' + spellListLabel(type)" [title]="'In ' + spellListLabel(type)"
                            class="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded bg-purple-container text-base text-on-purple-container">
                            <app-ui-icon name="book" />
                          </span>
                        }
                      }
                    </div>

                    <!-- Basic information stays visible when descriptions are collapsed. -->
                    @if (spellView() === 'PREPARED') { <app-spell-summary [spell]="spell.entity" /> }

                    <!-- Source Tags -->
                    <div class="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                      @if (spell.source) {
                        <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ spell.source }}</span>
                      }
                      @if (spell.castingSourceName) {
                        <span class="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{{ spell.castingSourceName }}</span>
                      }
                    </div>

                    }

                    <!-- Expandable Content -->
                    @if (!isExpanded(spellExpansionId(spell)) && spellView() === 'PREPARED') {
                      <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
                        @for (use of spell.uses ?? []; track use) {
                                                <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                                              }
                      </div>
                    }
                    @if (spellView() === 'PREPARED') { <app-feature-notes [notes]="spell.notes" (notesChanged)="updateSpellNotes(spell, $event)" /> }
                    @if (isExpanded(spellExpansionId(spell))) {
                      <app-sheet-detail-dialog [title]="spell.name" (closed)="toggleExpanded(spellExpansionId(spell))">
                      <p class="text-sm text-on-surface-variant">{{ helpers.spellLevelLabel(spell) }} · {{ helpers.spellSchoolLabel(spell.entity?.school ?? '') }} · {{ spell.castingSourceName }} · {{ spell.source }}</p>
                      <app-spell-details [spell]="spell.entity" />
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
                        @if (spell.uses?.length) {
                          <div class="mt-2 sm:mt-4 border-t border-outline-variant pt-2 sm:pt-4">
                            <div class="feature-uses-row" data-horizontal-row role="region" aria-label="Use trackers" tabindex="0">
                              @for (use of spell.uses; track use) {
                                                            <app-feature-uses 
                                                              [uses]="use"
                                                              (usesUpdated)="use.usedFreeUses = $event.usedFreeUses"
                                                            />
                                                          }
                            </div>
                          </div>
                        }
                        <app-feature-notes
                          [notes]="spell.notes"
                          (notesChanged)="updateSpellNotes(spell, $event)"
                        />
                    </app-sheet-detail-dialog>
                    }
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <p class="text-on-surface-variant italic">No spells for this filter.</p>
        }
      </div>
      </section>
    </div>
  `,
})
export class SpellsPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  private readonly dialogs = inject(AppDialogService);
  helpers = inject(CharacterHelpersService);
  
  highlightedId = signal<string | null>(null);

  readonly searchQuery = signal('');
  spellView = signal<'PREPARED' | 'KNOWN' | 'SPELLBOOK'>('PREPARED');
  readonly sourceSpellCounts = computed(() => {
    return spellSourceCounts(this.characterData()?.spells ?? [], this.pickerSources(), this.spellCastingSourcesList().slice(1));
  });
  spellRitualFilter = signal<SpellRitualFilter>('ALL');
  readonly spellLevelFilters = signal<number[]>([]);
  readonly spellCastingTimes = signal<SpellCastingTime[]>([]);
  readonly spellSchools = signal<SpellSchool[]>([]);
  readonly spellListLabel = spellListLabel;
  spellCastingSourceFilter = signal<string>('ALL');
  expandedItems = signal<Set<string>>(new Set());
  readonly activeFilterCount = computed(() => this.spellSchools().length + this.spellCastingTimes().length + this.spellLevelFilters().length + Number(this.spellRitualFilter() !== 'ALL'));

  clearFilters() {
    this.searchQuery.set('');
    this.spellLevelFilters.set([]);
    this.spellCastingTimes.set([]);
    this.spellSchools.set([]);
    this.spellRitualFilter.set('ALL');
  }


  character = computed(() => this.characterData()?.character ?? null);
  readonly pickerSources = computed(() => this.characterData()?.character?.featureSources?.filter(source => source.isSpellcastingSource) ?? []);

  readonly showSpellbook = computed(() => this.character()?.featureSources?.some(source => source.useSpellbook) ||
    this.characterData()?.spells?.some(spell => spell.listType === 'SPELLBOOK') || this.spellView() === 'SPELLBOOK');

  spellCastingSourcesList = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const sources = new Set(spells.map((spell) => spell.castingSourceName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(sources).sort()];
  });

  spellRitualFilterLabel = computed(() => {
    switch (this.spellRitualFilter()) {
      case 'RITUAL':
        return 'Only rituals';
      case 'NON_RITUAL':
        return 'No rituals';
      default:
        return 'All';
    }
  });

  isSpellLevelSelected(level: SpellLevelFilter): boolean {
    const selected = this.spellLevelFilters();
    return level === 'ALL' ? selected.length === 0 : selected.includes(level);
  }

  toggleSpellLevel(level: SpellLevelFilter): void {
    if (level === 'ALL') { this.spellLevelFilters.set([]); return; }
    this.spellLevelFilters.update(selected => selected.includes(level)
      ? selected.filter(value => value !== level) : [...selected, level]);
  }

  spellLevelFilterOptions = computed(() => {
    const levels = new Set((this.characterData()?.spells ?? []).map((spell) => spell.entity?.level ?? 0));
    const sortedLevels = Array.from(levels).sort((a, b) => a - b);

    return [
      { value: 'ALL' as const, label: 'All' },
      ...sortedLevels.map((level) => ({
        value: level,
        label: this.spellLevelHeader(level),
      })),
    ];
  });

  spellBonusItemsOverview = computed(() => {
    const inventory = this.characterData()?.inventory ?? [];
    const entries: SpellBonusItemOverview[] = [];

    inventory.forEach((item, index) => {
        const entity = item.entity?.item;
        if (!entity) return;

        const isEquipped = item.isEquipped ?? false;
        if (!isEquipped) return;

        const requiresAttunement = entity.reqAttune !== null && entity.reqAttune !== undefined;
        if (requiresAttunement && !(item.isAttuned ?? false)) return;

        const bonuses: string[] = [];
        if (entity.bonusSpellAttack) bonuses.push(`Spell Attack ${entity.bonusSpellAttack}`);
        if (entity.bonusSpellSaveDc) bonuses.push(`Spell Save DC ${entity.bonusSpellSaveDc}`);
        if (entity.bonusSpellDamage) bonuses.push(`Spell Damage ${entity.bonusSpellDamage}`);
        if (bonuses.length === 0) return;

        entries.push({
          key: `${item.name}:${item.source ?? ''}:${index}`,
          name: item.name,
          source: item.source,
          bonusesText: bonuses.join(', '),
        });
      });

    return entries;
  });

  spellSlotGroups = computed(() => {
    const spellSlots = this.character()?.spellSlots ?? {};
    return Object.entries(spellSlots)
      .filter(([, slots]) => slots.length > 0)
      .map(([source, slots]) => ({
        source,
        slots: [...slots]
          .sort((a, b) => a.level - b.level)
          .map((slot) => ({
            ...slot,
            regainCondition: slot.regainCondition ?? 'LONG_REST',
          })),
      }))
      .sort((a, b) => a.source.localeCompare(b.source));
  });

  spells = computed(() => {
    const spells = this.characterData()?.spells ?? [];
    const listTypeFilter = this.spellView();
    const ritualFilter = this.spellRitualFilter();
    const levelFilters = this.spellLevelFilters();
    const sourceFilter = this.spellCastingSourceFilter();
    const castingTimes = this.spellCastingTimes();
    const schools = this.spellSchools();
    const filtered = spells.filter((spell) => {
      const matchesListType = spell.listType === listTypeFilter;
      const isRitual = spell.entity?.meta?.ritual ?? false;
      const matchesRitual = ritualFilter === 'ALL'
        || (ritualFilter === 'RITUAL' && isRitual)
        || (ritualFilter === 'NON_RITUAL' && !isRitual);
      const spellLevel = spell.entity?.level ?? 0;
      const matchesLevel = !levelFilters.length || levelFilters.includes(spellLevel);
      const matchesSource = sourceFilter === 'ALL' || spell.castingSourceName === sourceFilter;
      return matchesListType && matchesRitual && matchesLevel && matchesSource && matchesCastingTime(spell.entity?.time, castingTimes) && matchesSpellSchool(spell.entity?.school, schools);
    });
    return [...filtered].sort((a, b) => {
      const relevance = compareSearchMatches(a.name, b.name, this.searchQuery());
      if (relevance) return relevance;
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
      if (!spell.name.toLowerCase().includes(this.searchQuery().trim().toLowerCase())) continue;
      const level = spell.entity?.level ?? 0;
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      grouped.get(level)!.push(spell);
    }

    return Array.from(grouped.entries())
      .map(([level, spells]) => ({ level, spells }))
      .sort((a, b) => compareSearchMatches(a.spells[0].name, b.spells[0].name, this.searchQuery()) || a.level - b.level);
  });

  constructor() {
    // Handle scroll/highlight on navigation
    effect(() => {
      const targetId = this.store.featureScrollTarget();
      if (!targetId || (!targetId.startsWith('spell-'))) return;
      if (targetId.startsWith('spell-')) {
        const target = this.characterData()?.spells?.find(spell => `spell-${spell.editorId ?? this.helpers.sourceId(spell.name + '-' + (spell.source ?? ''))}` === targetId);
        if (target) {
          this.spellView.set((target.listType ?? 'KNOWN') as 'PREPARED' | 'KNOWN' | 'SPELLBOOK');
          this.searchQuery.set('');
          this.spellCastingSourceFilter.set('ALL');
          this.spellLevelFilters.set([]);
          this.spellCastingTimes.set([]);
          this.spellSchools.set([]);
          this.spellRitualFilter.set('ALL');
          this.expandedItems.set(new Set([this.spellExpansionId(target)]));
        }
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

    // Clear spell slot overrides when character data updates (e.g., after rest)
    effect(() => {
      this.characterData();
      this.spellSlotUsedOverrides.set({});
    });
  }

  private spellKey(spell: any): string {
    return spellIdentity(spell);
  }

  spellExpansionId(spell: any): string { return 'spell-' + this.spellKey(spell); }

  getSpellListTypes(spell: any): string[] {
    const allSpells = this.characterData()?.spells ?? [];
    const key = this.spellKey(spell);
    const matching = allSpells.filter((s) => this.spellKey(s) === key);
    return matching.map((s) => s.listType).filter(Boolean) as string[];
  }

  hasSpellListType(spell: any, listType: string): boolean {
    return this.getSpellListTypes(spell).includes(listType);
  }

  async togglePreparedSpell(spell: any, event: Event) {
    event.stopPropagation();
    
    const key = this.spellKey(spell);
    const isPrepared = this.hasSpellListType(spell, 'PREPARED');
    if (this.isPreparationLocked(spell)) {
      return; // Don't allow toggling if the spell has uses (e.g., limited daily casts)
    }
    if (isPrepared && !await this.dialogs.confirm(`Are you sure you want to unprepare "${spell.name}"?`, 'Unprepare Spell', 'Unprepare')) {
      return;
    }
    const allSpells = [...this.characterData()?.spells ?? []];
    if (isPrepared) {
      // Remove the PREPARED version
      const index = allSpells.findIndex((s) => this.spellKey(s) === key && s.listType === 'PREPARED');
      if (index >= 0) {
        allSpells.splice(index, 1);
      }
    } else {
      // Add a PREPARED version by copying the current spell
      const preparedSpell = copySpellToList(spell, 'PREPARED');
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

  listTypesForSpell(spell: any): Array<'KNOWN' | 'SPELLBOOK' | 'PREPARED'> {
    const source = this.character()?.featureSources?.find(source => source.name === spell.castingSourceName);
    return source?.useSpellbook || this.hasSpellListType(spell, 'SPELLBOOK') ? ['KNOWN', 'SPELLBOOK', 'PREPARED'] : ['KNOWN', 'PREPARED'];
  }

  isPreparationLocked(spell: any): boolean {
    return preparationLocked(spell, this.characterData()?.spells ?? []);
  }

  requiresConcentration(spell: any): boolean {
    return spell.entity?.duration?.some((duration: { concentration?: boolean }) => duration.concentration) ?? false;
  }

  compactSchoolLabel(school: string): string {
    return shortSpellSchoolLabel(school);
  }

  spellLevelHeader(level: number): string {
    return level === 0 ? 'Cantrips' : `Level ${level}`;
  }

  cycleSpellRitualFilter() {
    const current = this.spellRitualFilter();
    const next = current === 'ALL' ? 'RITUAL' : current === 'RITUAL' ? 'NON_RITUAL' : 'ALL';
    this.spellRitualFilter.set(next);
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

  private persistSpellSlotUsed(source: string, level: number, used: number) {
    const data = this.characterData();
    const character = data?.character;
    const spellSlots = character?.spellSlots;
    const sourceSlots = spellSlots?.[source];
    if (!data || !character || !spellSlots || !Array.isArray(sourceSlots)) return;

    const updatedSourceSlots = sourceSlots.map((existingSlot) =>
      existingSlot.level === level
        ? { ...existingSlot, used }
        : existingSlot
    );

    this.store.setCharacter({
      ...data,
      character: {
        ...character,
        spellSlots: {
          ...spellSlots,
          [source]: updatedSourceSlots,
        },
      },
    });
  }

  toggleSpellSlot(source: string, slot: { level: number; total: number; used: number }, index: number) {
    const currentUsed = this.spellSlotUsed(source, slot);
    const isCurrentlyUsed = index < currentUsed;
    const newUsed = isCurrentlyUsed ? index : index + 1;
    const key = this.spellSlotKey(source, slot.level);

    this.spellSlotUsedOverrides.update((prev) => ({
      ...prev,
      [key]: newUsed,
    }));
    this.persistSpellSlotUsed(source, slot.level, newUsed);
  }

  addOneSpellSlot(source: string, slot: { level: number; total: number; used: number }) {
    const currentUsed = this.spellSlotUsed(source, slot);
    const newUsed = Math.min(currentUsed + 1, slot.total);
    const key = this.spellSlotKey(source, slot.level);

    this.spellSlotUsedOverrides.update((prev) => ({
      ...prev,
      [key]: newUsed,
    }));
    this.persistSpellSlotUsed(source, slot.level, newUsed);
  }

  toggleExpanded(id: string) {
    this.expandedItems.set(this.isExpanded(id) ? new Set() : new Set([id]));
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

  updateSpellNotes(spell: any, event: FeatureNotes[]): void {
    spell.notes = event;
  }

  hasUses(spell: any): boolean {
    return spell.uses !== undefined && spell.uses.length > 0;
  }

  determineIconForSpell(spell: any): string {
    if (this.isPreparationLocked(spell)) {
      return '🔒';
    }
    if (this.hasSpellListType(spell, 'PREPARED')) {
      return '-';
    } else {
      return '+'
    }
  }
}
