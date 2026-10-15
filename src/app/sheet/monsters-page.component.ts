import { UiIconComponent } from '../ui-icon.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { MonsterStatBlockComponent } from './monster-stat-block.component';
import { MonsterPresentation } from './monster-presentation';
import { FeatureUsesComponent } from './feature-uses.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { Component, computed, input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ExportedCharacter,
  Monster,
  MonsterCasting,
  MonsterSpellcasting,
} from '../models/character.model';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-monsters-page',
  imports: [UiIconComponent, CommonModule, CapitalizeFirstPipe, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent, MonsterStatBlockComponent],
  styles: [`
    .flash-highlight {
      animation: monster-flash 1.6s ease-out;
    }

    @keyframes monster-flash {
      0% {
        background-color: rgba(79, 219, 216, 0.5);
        box-shadow: 0 0 0 0 rgba(79, 219, 216, 0.8);
      
      }
      40% {
        background-color: rgba(79, 219, 216, 0.25);
        box-shadow: 0 0 0 8px rgba(79, 219, 216, 0.2);
        border-color: rgb(79, 219, 216);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(79, 219, 216, 0);
      
      }
    }
  `],
  template: `
    <div class="bg-surface-container-highest p-8 rounded-lg border-2 border-outline shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Monsters & Companions</h2>
      
      @if (monsters().length > 0) {
        <div class="space-y-6">
          @for (monster of monsters(); track monster.name) {
            <div class="border-2 border-teal rounded-lg p-4 bg-surface-container hover:shadow-md transition-shadow\" [attr.id]=\"'monster-' + helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? ''))\" [class.flash-highlight]=\"highlightedId() === ('monster-' + helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? '')))\">
              <!-- Header (always visible, clickable) -->
              <button
                type="button"
                class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2 mb-3"
                (click)="toggleExpanded('monster-' + monster.name)"
              >
                <div class="flex justify-between items-start">
                  <h3 class="text-2xl font-bold text-teal">{{ monster.name }}</h3>
                  <span class="text-2xl text-teal font-bold"><app-ui-icon [name]="isExpanded('monster-' + monster.name) ? \'minus\' : \'plus\'" /></span>
                </div>
              </button>
              @if (monster.entity) {
                                              <!-- Size, Type, Alignment -->
                <div class="text-sm text-on-surface pb-2">
                  @if (monster.entity.size && monster.entity.size.length > 0) {
                    <span>
                      @for (size of monster.entity.size; track size) {
                        <span>{{ getSizeText(size) }}</span>
                        @if (!$last) {
                          <span>, </span>
                        }
                      }
                    </span>
                  }
                  @if (monster.entity.type && monster.entity.type.type) {
                    <span> {{ monster.entity.type.type | capitalizeFirst}}</span>
                  }
                  @if (monster.entity.alignment && monster.entity.alignment.length > 0) {
                    <span>, 
                      @for (align of monster.entity.alignment; track align) {
                        <span>{{ align }}</span>
                      }
                    </span>
                  }
                </div>
              }
              <!-- Source Tag -->
              @if (monster.source) {
                <div class="mb-4 pb-4 border-b border-outline-variant">
                  <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded ">{{ monster.source }}</span>
                </div>
              }

              @if (monster.entity) {
                <!-- HP Tracker -->
                @if (monster.hpEnabled) {
                  <div class="space-y-3 my-4">
                    <div class="space-y-1 p-3 bg-primary-container rounded-md border-2 border-primary">
                    <div class="flex flex-wrap gap-2 justify-between">
                      <div class="flex gap-3 items-center">
                      <div class="text-sm text-on-primary-container uppercase font-bold min-w-[3rem]">HP</div>
                      <input
                        type="number"
                        [value]="monster.monsterCurrentHP ?? getEffectiveMonsterMaxHP(monster)"
                        (input)="updateMonsterHP(monster, $any($event.target).value)"
                        class="text-on-primary-container w-20 p-2 border-2 border-primary rounded-md text-base font-bold focus:ring-2 focus:ring-primary focus:border-primary"
                        min="0"
                        [max]="getEffectiveMonsterMaxHP(monster)"
                      >
                      <div class="text-on-primary-container">/</div>
                      <div class="text-on-primary-container font-bold"
                      [class.text-teal]="monster.monsterMaxHpOverride !== undefined"
                      >{{ getEffectiveMonsterMaxHP(monster) }}</div>
                      </div>
                      <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-on-primary-container">
                      <div>Base:</div>
                      <div>{{ monster.monsterMaxHP ?? 0 }}</div>
                      <label class="flex items-center gap-2 text-on-primary-container">
                        <span>Override</span>
                        <input
                          type="number"
                          [value]="getMonsterMaxHpOverrideInput(monster)"
                          (input)="onMonsterMaxHpOverrideInput(monster, $any($event.target).value)"
                          (change)="commitMonsterMaxHpOverride(monster)"
                          (blur)="commitMonsterMaxHpOverride(monster)"
                          class="w-20 px-2 py-1 border border-primary rounded-md text-center focus:ring-2 focus:ring-primary focus:border-primary"
                          min="0"
                        />
                      </label>
                      <button
                        type="button"
                        class="px-2 py-1 border border-primary rounded-md hover:bg-primary text-on-primary-containerhover:border-surface hover:text-on-primary transition-colors text-xs font-semibold "
                        [class.border-teal]="monster.monsterMaxHpOverride !== undefined"
                        (click)="clearMonsterMaxHpOverride(monster)"
                      >
                        Clear
                      </button>
                    </div>
    
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm">
                      @if (monster.entity.hp) {
                        ≈
                        @if (monster.entity.hp.average) {
                        {{ monster.entity.hp.average }}
                        }
                        @if (monster.entity.hp.formula) {
                          <span> ({{ monster.entity.hp.formula }})</span>
                        }
                        @if (monster.entity.hp.special) {
                          <span class="italic"> {{ monster.entity.hp.special }}</span>
                        }
                      }
                    </div>
                  </div>
                </div>

                    
                    <!-- Max HP Override -->

                    
                    <!-- Temp HP -->
                    <div class="flex gap-3 items-center p-3 bg-secondary-container rounded-md border-2 border-green">
                      <div class="text-sm text-on-secondary-container uppercase font-bold min-w-[3rem]">Temp HP</div>
                      <input
                        type="number"
                        [value]="monster.monsterTempHP ?? 0"
                        (input)="updateMonsterTempHP(monster, $any($event.target).value)"
                        class="text-on-secondary-container w-24 p-2 border-2 border-green rounded-md text-base font-bold focus:ring-2 focus:ring-green focus:border-green"
                        min="0"
                      >
                      @if (monster.monsterTempHP && monster.monsterTempHP > 0) {
                        <button
                          (click)="clearMonsterTempHP(monster)"
                          class="px-2 py-1 bg-secondary-container border border-secondary text-on-secondary-container rounded text-xs font-semibold transition-colors hover:bg-secondary hover:text-on-secondary"
                          title="Clear temp HP"
                        >
                          Clear
                        </button>
                      }

                  </div>
                }  @else if (monster.entity.hp) {
                  <div class="space-y-3 my-4">
                    <div class="flex flex-wrap gap-2 justify-between p-3 bg-primary-container rounded-md border-2 border-primary">
                      <div class="flex gap-2 items-center">
                      <div class="text-sm text-on-primary-container uppercase font-bold min-w-[3rem]">HP</div>
                      <div class="text-sm text-on-primary-container">
                      @if (monster.entity.hp.average) {
                          {{ monster.entity.hp.average }}
                        }
                        @if (monster.entity.hp.formula) {
                          <span> ({{ monster.entity.hp.formula }})</span>
                        }
                        @if (monster.entity.hp.special) {
                          <span class="italic"> {{ monster.entity.hp.special }}</span>
                        }
                      </div>
                    </div>
                  </div>
                  </div>
                }
                <!-- AC, Speed, Initiative, CR -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                  @if (monster.entity.ac && monster.entity.ac.length > 0) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">AC</div>
                      <div class="text-2xl font-bold text-primary">
                        @for (ac of monster.entity.ac; track $index) {
                          <app-entry-renderer [entry]="{ text: formatArmorClass(ac) }" />
                        }
                      </div>
                    </div>
                  }
                  <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                    <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">Initiative</div>
                    <div class="text-2xl font-bold text-tertiary">{{ getInitiative(monster) }}</div>
                  </div>
                  @if (monster.entity.speed) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">Speed</div>
                      <div class="text-xl font-bold text-on-surface-container-high">{{ formatSpeeds(monster.entity.speed) }}</div>
                    </div>
                  }
                  @if (monster.entity.cr) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">CR</div>
                      <div class="text-2xl font-bold text-tertiary">{{ typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr }} 
                        <span class="text-xl">(PB +{{ getProficiencyBonusFromCR(typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr) }})</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Expandable Content: Ability Scores and Beyond -->
                @if (isExpanded('monster-' + monster.name)) {

                  <div class="mt-4 pt-4 border-t border-outline-variant space-y-3">

                  <app-monster-stat-block [value]="monster" [showSummary]="false" />
                  </div>
                  <div class="mt-4 pt-4 border-t border-outline-variant space-y-3">
                  @for (use of monster.uses ?? []; track use) {
                    <app-feature-uses [uses]="use" (usesUpdated)="use.usedFreeUses = $event.usedFreeUses" />
                  }

                    <app-feature-notes [notes]="monster.notes" (notesChanged)="monster.notes = $event" />  
                </div>
                }
              }
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-10 px-5 text-on-surface-variant text-base">
          <p>No monsters or companions yet.</p>
        </div>
      }
    </div>
  `,
})
export class MonstersPageComponent extends MonsterPresentation {
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  helpers = inject(CharacterHelpersService);
  expandedItems = signal<Set<string>>(new Set());
  
  highlightedId = signal<string | null>(null);

  monsters = computed(() => 
    (this.characterData()?.monsters ?? []).sort((a, b) => {
      // First: hpEnabled monsters first (true before false)
      const aHpEnabled = a.hpEnabled ? 1 : 0;
      const bHpEnabled = b.hpEnabled ? 1 : 0;
      
      if (aHpEnabled !== bHpEnabled) {
        return bHpEnabled - aHpEnabled; // true (1) sorts before false (0)
      }
      
      // Then: sort by CR (treating ? and no CR as -1)
      const getCRValue = (cr: any): number => {
        if (!cr) return -1;
        const crStr = typeof cr === 'string' ? cr : cr.cr;
        if (crStr === '?' || !crStr) return -1;
        
        // Handle fractions like "1/4", "1/2", etc.
        if (crStr.includes('/')) {
          const [numerator, denominator] = crStr.split('/').map(Number);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
          }
          return -1;
        }
        
        const parsed = parseFloat(crStr);
        return isNaN(parsed) ? -1 : parsed;
      };
      
      const aCR = getCRValue(a.entity?.cr);
      const bCR = getCRValue(b.entity?.cr);
      
      return aCR - bCR;
    })
  );

  constructor() {
    super();
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

  updateMonsterHP(monster: Monster, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      const maxHP = this.getEffectiveMonsterMaxHP(monster);
      monster.monsterCurrentHP = Math.max(0, Math.min(numValue, maxHP ?? 0));
    }
  }

  getEffectiveMonsterMaxHP(monster: Monster): number {
    if (monster.monsterMaxHpOverride !== null && monster.monsterMaxHpOverride !== undefined) {
      return monster.monsterMaxHpOverride;
    }
    return monster.monsterMaxHP ?? 0;
  }

  getMonsterMaxHpOverrideInput(monster: Monster): string {
    if (monster.monsterMaxHpOverride !== null && monster.monsterMaxHpOverride !== undefined) {
      return String(monster.monsterMaxHpOverride);
    }
    return String(monster.monsterMaxHP ?? 0);
  }

  onMonsterMaxHpOverrideInput(monster: Monster, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      monster.monsterMaxHpOverride = monster.monsterMaxHP ?? 0;
    } else {
      const numValue = Number(trimmed);
      if (Number.isFinite(numValue) && numValue > 0) {
        monster.monsterMaxHpOverride = numValue;
      } else {
        monster.monsterMaxHpOverride = monster.monsterMaxHP ?? 0;
      }
    }
  }

  commitMonsterMaxHpOverride(monster: Monster) {
    // Adjust current HP if it exceeds new max
    const maxHP = this.getEffectiveMonsterMaxHP(monster);
    if (monster.monsterCurrentHP && monster.monsterCurrentHP > maxHP) {
      monster.monsterCurrentHP = maxHP;
    }
  }

  clearMonsterMaxHpOverride(monster: Monster) {
    monster.monsterMaxHpOverride = undefined;
    // Adjust current HP if it exceeds base max
    const baseMax = monster.monsterMaxHP ?? 0;
    if (monster.monsterCurrentHP && monster.monsterCurrentHP > baseMax) {
      monster.monsterCurrentHP = baseMax;
    }
  }

  updateMonsterTempHP(monster: Monster, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      monster.monsterTempHP = Math.max(0, numValue);
    }
  }

  clearMonsterTempHP(monster: Monster) {
    monster.monsterTempHP = 0;
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
}
