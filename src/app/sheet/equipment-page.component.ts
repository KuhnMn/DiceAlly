import { Component, computed, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportedCharacter, Entry, DisplayItem, InventoryItem } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-equipment-page',
  imports: [CommonModule, EntryRendererComponent, FeatureUsesComponent],
  styles: [`
    .flash-highlight {
      animation: item-flash 1.6s ease-out;
    }

    @keyframes item-flash {
      0% {
        box-shadow: 0 0 0 0 rgba(var(--md-sys-color-green) / 0.6);
        border-color: rgb(var(--md-sys-color-green));
      }
      60% {
        box-shadow: 0 0 0 8px rgba(var(--md-sys-color-green) / 0.15);
        border-color: rgb(var(--md-sys-color-green));
      }
      100% {
        box-shadow: 0 0 0 0 rgba(var(--md-sys-color-green) / 0);
        border-color: rgb(var(--md-sys-color-outline-variant));
      }
    }
    
    .property-badge, .mastery-badge {
      position: relative;
      cursor: help;
      display: inline-block;
    }
    .property-badge .tooltip-box, .mastery-badge .tooltip-box {
      visibility: hidden;
      position: absolute;
      z-index: 1000;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background-color: #1f2937;
      color: #fff;
      text-align: left;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.5;
      white-space: normal;
      width: 320px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }
    .property-badge:hover .tooltip-box, .mastery-badge:hover .tooltip-box {
      visibility: visible;
    }
    .property-badge .tooltip-box::after, .mastery-badge .tooltip-box::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: #1f2937 transparent transparent transparent;
    }
    .tooltip-box p {
      margin: 0;
      color: #f3f4f6;
    }
    .tooltip-box ul, .tooltip-box ol {
      margin: 8px 0 0 20px;
      padding: 0;
      color: #f3f4f6;
    }
    .tooltip-box li {
      margin: 4px 0;
    }
    .tooltip-box strong {
      color: #fbbf24;
    }
  `],
  template: `
    <div class="bg-surface-container-highest p-8 rounded-lg border-2 border-outline shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Equipment & Inventory</h2>

      <!-- Currency Tracker -->
      <div class="mb-6 border-4 border-tertiary rounded-lg p-4 bg-tertiary-container">
        <h3 class="text-lg font-bold mb-3 text-on-tertiary-container">Currency</h3>
        <div class="flex justify-between gap-6 items-center flex-wrap bg-surface-variant border border-outline-variant rounded-md p-1 px-2">
          <div class="flex items-center gap-2  ">
            <label class="text-sm font-semibold text-tertiary w-16">Gold</label>
            <input
              type="number"
              [value]="goldAmount()"
              (input)="updateCurrency('gold', $any($event.target).value)"
              class="w-24 px-3 py-2 border-2 border-tertiary rounded-md focus:ring-2 focus:ring-tertiary focus:border-tertiary"
              min="0"
            />
            <span class="text-xs text-tertiary">GP</span>
          </div>
          <div class="flex items-center gap-2  ">
            <label class="text-sm font-semibold text-secondary w-16">Silver</label>
            <input
              type="number"
              [value]="silverAmount()"
              (input)="updateCurrency('silver', $any($event.target).value)"
              class="w-24 px-3 py-2 border-2 border-secondary rounded-md focus:ring-2 focus:ring-secondary focus:border-secondary"
              min="0"
            />
            <span class="text-xs text-secondary">SP</span>
          </div>
          <div class="flex items-center gap-2 ">
            <label class="text-sm font-semibold text-primary w-16 ">Copper</label>
            <input
              type="number"
              [value]="copperAmount()"
              (input)="updateCurrency('copper', $any($event.target).value)"
              class="w-24 px-3 py-2 border-2 border-primary rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
              min="0"
            />
            <span class="text-xs text-primary">CP</span>
          </div>
        </div>
      </div>

      <!-- Inventory -->
      <div class="space-y-4">
        <h3 class="text-xl font-bold mb-3">Items</h3>
        @if (inventory().length > 0) {
          @for (item of inventory(); track item.name) {
            <div class="border-2 border-green rounded-lg p-4 bg-surface-container" [attr.id]="'item-' + helpers.sourceId(item.name + '-' + (item.source ?? ''))" [class.flash-highlight]="highlightedId() === ('item-' + helpers.sourceId(item.name + '-' + (item.source ?? '')))">
              <!-- Header (always visible, clickable) -->
              <button
                type="button"
                class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2"
                (click)="toggleExpanded('item-' + item.name)"
              >
                <div class="flex flex-wrap items-center justify-between gap-2 w-full">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-xl font-bold text-green">{{ item.name }}</h3>
                    @if (item.entity?.itemType) {
                      <span class="text-xs bg-green-container text-on-green-container px-2 py-0.5 rounded">{{ item.entity?.itemType }}</span>
                    }
                                    @if (getItemProp(item, 'weaponCategory')) {
                  <span class="text-xs bg-blue-container text-on-blue-container px-2 py-0.5 rounded capitalize">{{ getItemProp(item, 'weaponCategory') }}</span>
                }
                @if (getItemProp(item, 'rarity') && getItemProp(item, 'rarity') !== 'none') {
                  <span class="text-xs bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded capitalize">{{ getItemProp(item, 'rarity') }}</span>
                }
                @if (getItemProp(item, 'scfType')) {
                  <span class="text-xs bg-purple-container text-on-purple-container px-2 py-0.5 rounded">Focus: {{ getItemProp(item, 'scfType') }}</span>
                }
                @for (tag of getItemTypeTags(item); track tag) {
                  <span class="text-xs bg-surface-container-low text-on-surface px-2 py-0.5 rounded">{{ tag }}</span>
                }
                  </div>
                  <span class="text-xl text-green font-bold">{{ isExpanded('item-' + item.name) ? '−' : '+' }}</span>
                </div>
              </button>

              <!-- Basic Info (always visible) -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-on-surface-container space-y-1 mt-2">
                @if (getItemProp(item, 'weight')) {
                  <div><span class="font-semibold">Weight:</span> {{ getItemProp(item, 'weight') }} lb.</div>
                }
                @if (getItemProp(item, 'value')) {
                  <div><span class="font-semibold">Value:</span> {{ formatGold(getItemProp(item, 'value')) }}</div>
                }
                @if (item.entity?.ac) {
                  <div><span class="font-semibold">AC:</span> {{ item.entity?.ac }}</div>
                }
                @if (getItemProp(item, 'dmg1')) {
                  <div><span class="font-semibold">Damage:</span> {{ getItemProp(item, 'dmg1') }}@if (getItemProp(item, 'dmgType')) { {{ getItemProp(item, 'dmgType') }}}@if (getItemProp(item, 'dmg2')) { ({{ getItemProp(item, 'dmg2') }} versatile)}</div>
                }
                @if (getItemProp(item, 'range')) {
                  <div><span class="font-semibold">Range:</span> {{ getItemProp(item, 'range') }} ft.</div>
                }
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm text-on-surface-container space-y-1 mt-2">
                @if (item.entity?.properties?.length) {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">Properties:</span>
                    @for (prop of item.entity?.properties; track prop.name) {
                      <span class="property-badge text-xs bg-teal-container text-on-teal-container px-2 py-1 rounded font-medium">
                        {{ prop.name }}
                        @if (prop.entry) {
                          <div class="tooltip-box">
                            @if (prop.entry && !isArray(prop.entry)) {
                              <app-entry-renderer [entries]="[prop.entry]"></app-entry-renderer>
                            } @else if (isArray(prop.entry)) {
                              <app-entry-renderer [entries]="prop.entry"></app-entry-renderer>
                            }
                          </div>
                        }
                      </span>
                    }
                  </div>
                }
                @if (item.entity?.masteries?.length) {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">Mastery:</span>
                    @for (mastery of item.entity?.masteries; track mastery.name) {
                      <span class="mastery-badge text-xs bg-secondary-container text-on-secondary-container px-2 py-1 rounded font-medium">
                        {{ mastery.name }}
                        @if (mastery.entry) {
                          <div class="tooltip-box">
                            @if (mastery.entry && !isArray(mastery.entry)) {
                              <app-entry-renderer [entries]="[mastery.entry]"></app-entry-renderer>
                            } @else if (isArray(mastery.entry)) {
                              <app-entry-renderer [entries]="mastery.entry"></app-entry-renderer>
                            }
                          </div>
                        }
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- Source && Rarity Tags -->
              <div class="flex flex-wrap items-center gap-2">

                @if (item.source) {
                  <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded">{{ item.source }}</span>
                }
              </div>

              <!-- Expandable Content -->
              @if (isExpanded('item-' + item.name)) {
                <div class="mt-3 pt-3 border-t border-outline-variant">
                  <!-- Bonuses Section -->
                  @if (hasAnyBonus(item)) {
                    <div class="mt-2 p-2 bg-blue-container border border-blue rounded-lg">
                      <h4 class="text-sm font-bold text-on-blue-container mb-2">Bonuses</h4>
                      <div class="text-sm text-on-blue-container space-y-1">
                        @if (getItemProp(item, 'bonusWeapon')) {
                          <div>• Weapon: {{ getItemProp(item, 'bonusWeapon') }}</div>
                        }
                        @if (getItemProp(item, 'bonusWeaponAttack')) {
                          <div>• Weapon Attack: {{ getItemProp(item, 'bonusWeaponAttack') }}</div>
                        }
                        @if (getItemProp(item, 'bonusWeaponDamage')) {
                          <div>• Weapon Damage: {{ getItemProp(item, 'bonusWeaponDamage') }}</div>
                        }
                        @if (getItemProp(item, 'bonusSavingThrow')) {
                          <div>• Saving Throws: {{ getItemProp(item, 'bonusSavingThrow') }}</div>
                        }
                        @if (getItemProp(item, 'bonusSpellAttack')) {
                          <div>• Spell Attack: {{ getItemProp(item, 'bonusSpellAttack') }}</div>
                        }
                        @if (getItemProp(item, 'bonusSpellSaveDc')) {
                          <div>• Spell Save DC: {{ getItemProp(item, 'bonusSpellSaveDc') }}</div>
                        }
                        @if (getItemProp(item, 'bonusSpellDamage')) {
                          <div>• Spell Damage: {{ getItemProp(item, 'bonusSpellDamage') }}</div>
                        }
                        @if (getItemProp(item, 'bonusAc')) {
                          <div>• AC Bonus: {{ getItemProp(item, 'bonusAc') }}</div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Item Description -->
                  @if (getItemProp(item, 'entries')) {
                    <div class="mt-3">
                      <app-entry-renderer [entries]="getItemEntries(item)"></app-entry-renderer>
                    </div>
                  }

                  <!-- Uses Tracking -->

                </div>
              }
              <!-- Footer (always visible) -->
                  @if (item.uses?.length) {
                    <div class="mt-4 border-t border-outline-variant pt-4">
                      @for (use of item.uses; track use.tag) {
                        <app-feature-uses 
                          [uses]="use"
                          (usesUpdated)="updateItemUses(item, $event)"
                        />
                      }
                    </div>
                  }

              
              <div class="flex flex-wrap items-center gap-3 mb-2 mt-4 justify-between">
                <!-- Equipped Checkbox -->
                 <div class="flex flex-wrap items-center gap-3">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="item.isEquipped ?? false"
                    (change)="toggleEquipped(item)"
                    class="w-5 h-5 text-green border-outline-variant rounded focus:ring-2 focus:ring-green accent-green"
                  />
                  <span class="ml-2 text-sm font-semibold text-on-surface">Equipped</span>
                </label>

                <!-- Attunement (only for equipped items that require attunement) -->
                @if (item.isEquipped && requiresAttunement(item)) {
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="item.isAttuned ?? false"
                      (change)="toggleAttuned(item)"
                      class="w-5 h-5 text-purple border-outline-variant rounded focus:ring-2 focus:ring-purple accent-purple"
                    />
                    <span class="ml-2 text-sm font-semibold text-purple">✨ Attuned</span>
                  </label>
                }
                 </div>
                <!-- Count (for multiple items) -->
                @if (item.allowMultiples) {
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-semibold text-on-surface">Quantity:</label>
                    <input
                      type="number"
                      [value]="item.count ?? 1"
                      (input)="updateItemCount(item, $any($event.target).value)"
                      class="w-20 px-2 py-1 border-2 border-outline-variant rounded-md focus:ring-2 focus:ring-green focus:border-green text-center"
                      min="0"
                    />
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <p class="text-on-surface-variant italic">No items in inventory</p>
        }
      </div>
    </div>
  `,
})
export class EquipmentPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  helpers = inject(CharacterHelpersService);
  
  highlightedId = signal<string | null>(null);
  
  character = computed(() => this.characterData()?.character ?? null);
  inventory = computed(() => this.characterData()?.inventory ?? []);
  
  // Currency tracking signals
  goldAmount = signal(0);
  silverAmount = signal(0);
  copperAmount = signal(0);
  expandedItems = signal<Set<string>>(new Set());
  
  // Expose Array for template use
  readonly isArray = Array.isArray;

  constructor() {
    // Sync currency from character data whenever it changes
    effect(() => {
      const currency = this.character()?.currency ?? {};
      this.goldAmount.set(currency['gold'] ?? 0);
      this.silverAmount.set(currency['silver'] ?? 0);
      this.copperAmount.set(currency['copper'] ?? 0);
    });

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

  updateCurrency(type: string, value: string) {
    const numValue = Number(value) || 0;
    const char = this.character();
    if (!char) return;
    
    if (!char.currency) {
      char.currency = {};
    }
    
    char.currency[type] = numValue;
    
    // Update the corresponding signal
    if (type === 'gold') {
      this.goldAmount.set(numValue);
    } else if (type === 'silver') {
      this.silverAmount.set(numValue);
    } else if (type === 'copper') {
      this.copperAmount.set(numValue);
    }
  }

  toggleEquipped(item: any) {
    item.isEquipped = !item.isEquipped;
    // If unequipping, also remove attunement
    if (!item.isEquipped) {
      item.isAttuned = false;
    }
  }

  toggleAttuned(item: any) {
    item.isAttuned = !item.isAttuned;
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

  requiresAttunement(item: any): boolean {
    const reqAttune = item.entity?.item?.['reqAttune'];
    return reqAttune !== null && reqAttune !== undefined;
  }

  getItemProp(item: any, prop: string): any {
    if (!item.entity?.item) return null;
    return item.entity.item[prop];
  }

  formatGold(copperValue: any): string {
    const value = Number(copperValue);
    if (!value || isNaN(value)) return '—';
    const gold = value / 10000;
    if (gold >= 1) {
      return `${gold.toFixed(2)} gp`;
    }
    const silver = value / 100;
    if (silver >= 1) {
      return `${silver.toFixed(1)} sp`;
    }
    return `${value} cp`;
  }

  getItemEntries(item: any): Entry[] {
    const entries = item.entity?.item?.['entries'];
    if (Array.isArray(entries)) {
      return entries as Entry[];
    }
    return [];
  }

  getItemProperties(item: InventoryItem): string {
    const properties = item.entity?.properties;
    if (!properties || !Array.isArray(properties)) return '—';
    return properties.map((p: any) => p.name).join(', ');
  }

  getItemMasteries(item: InventoryItem): string {
    const masteries = item.entity?.masteries;
    if (!masteries || !Array.isArray(masteries)) return '—';
    return masteries.map((m: any) => m.name).join(', ');
  }



  getItemTypeTags(item: any): string[] {
    const tags: string[] = [];
    const entity = item.entity?.item;
    if (!entity) return tags;

    // Check boolean flags for item types
    const typeChecks = [
      { flag: entity.weapon, label: 'Weapon' },
      { flag: entity.armor, label: 'Armor' },
      { flag: entity.sword, label: 'Sword' },
      { flag: entity.axe, label: 'Axe' },
      { flag: entity.spear, label: 'Spear' },
      { flag: entity.crossbow, label: 'Crossbow' },
      { flag: entity.bow, label: 'Bow' },
      { flag: entity.polearm, label: 'Polearm' },
      { flag: entity.arrow, label: 'Arrow' },
      { flag: entity.firearm, label: 'Firearm' },
      { flag: entity.bolt, label: 'Bolt' },
      { flag: entity.bulletFirearm, label: 'Bullet (Firearm)' },
      { flag: entity.mace, label: 'Mace' },
      { flag: entity.needleBlowgun, label: 'Needle (Blowgun)' },
      { flag: entity.club, label: 'Club' },
      { flag: entity.bulletSling, label: 'Bullet (Sling)' },
      { flag: entity.hammer, label: 'Hammer' },
      { flag: entity.net, label: 'Net' },
      { flag: entity.cellEnergy, label: 'Energy Cell' },
      { flag: entity.lance, label: 'Lance' },
    ];

    for (const check of typeChecks) {
      if (check.flag) {
        tags.push(check.label);
      }
    }

    return tags;
  }

  hasAnyBonus(item: any): boolean {
    const entity = item.entity?.item;
    if (!entity) return false;
    
    return !!(
      entity.bonusWeapon ||
      entity.bonusWeaponAttack ||
      entity.bonusWeaponDamage ||
      entity.bonusSavingThrow ||
      entity.bonusSpellAttack ||
      entity.bonusSpellSaveDc ||
      entity.bonusSpellDamage ||
      entity.bonusAc
    );
  }

  updateItemUses(item: any, event: { usedFreeUses: number; tag?: string }) {
    if (item.uses) {
      const useEntry = item.uses.find((u: any) => u.tag === event.tag);
      if (useEntry) {
        useEntry.usedFreeUses = event.usedFreeUses;
      }
    }
  }

  updateItemCount(item: any, value: string) {
    const numValue = Math.max(0, parseInt(value) || 0);
    item.count = numValue;
  }
}
