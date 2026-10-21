import { compareSearchMatches, rankSearchResults } from '../search-ranking';
import { ListControlsComponent } from '../list-controls.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { ItemRuleTagComponent } from './item-rule-tag.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
import { RuleDetailsComponent } from './rule-details.component';
import { ItemCatalogComponent } from '../editor/item-catalog.component';
import { UiIconComponent } from '../ui-icon.component';
import { AppDialogService } from '../services/app-dialog.service';
import { Component, computed, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, Entry, InventoryItem, ItemEntity, FeatureNotes } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { FeatureUsesComponent } from './feature-uses.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-equipment-page',
  imports: [ListControlsComponent, SheetListLayoutComponent, ItemRuleTagComponent, SheetDetailDialogComponent, HorizontalRowDirective, RuleDetailsComponent, ItemCatalogComponent, UiIconComponent, CommonModule, FormsModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent],
  styles: [`
    /* Theme colors are plain CSS utilities, not Tailwind responsive utilities. */
    @media (min-width: 768px) {
      .currency-tracker .currency-row {
        background-color: var(--md-sys-color-surface-variant);
        border-color: var(--md-sys-color-outline);
      }
      .currency-tracker [data-coin="gold"] {
        --coin-color: var(--md-sys-color-tertiary);
      }
      .currency-tracker [data-coin="silver"] {
        --coin-color: var(--md-sys-color-secondary);
      }
      .currency-tracker [data-coin="copper"] {
        --coin-color: var(--md-sys-color-primary);
      }
      .currency-tracker [data-coin] {
        color: var(--coin-color);
      }
      .currency-tracker input {
        background-color: transparent;
        border-color: var(--coin-color);
        color: var(--md-sys-color-on-surface);
      }
      .currency-tracker input:focus {
        border-color: var(--coin-color);
        outline: 2px solid var(--coin-color);
        outline-offset: 0;
      }
    }
    .flash-highlight {
      animation: item-flash 1.6s ease-out;
    }

    @keyframes item-flash {
      0% {
        background-color: rgba(152, 216, 81, 0.5);
        box-shadow: 0 0 0 0 rgba(152, 216, 81, 0.8);
        border-color: rgb(152, 216, 81);
      }
      40% {
        background-color: rgba(152, 216, 81, 0.25);
        box-shadow: 0 0 0 8px rgba(152, 216, 81, 0.2);
        border-color: rgb(152, 216, 81);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(152, 216, 81, 0);
        border-color: rgb(var(--md-sys-color-outline-variant));
      }
    }
    
  `],
  templateUrl: './equipment-page.component.html',
})
export class EquipmentPageComponent {
  readonly coins = [
    { kind: 'gold', label: 'Gold (GP)', name: 'Gold', unit: 'GP' },
    { kind: 'silver', label: 'Silver (SP)', name: 'Silver', unit: 'SP' },
    { kind: 'copper', label: 'Copper (CP)', name: 'Copper', unit: 'CP' },
  ];
  readonly searchQuery = signal('');
  readonly inventoryFilter = signal<'all' | 'equipped' | 'attuned'>('all');
  readonly inventoryFilters = [{ value: 'all', label: 'All' }, { value: 'equipped', label: 'Equipped' }, { value: 'attuned', label: 'Attuned' }] as const;
  readonly bonusFields = [{ key: 'bonusWeapon', label: 'Weapon' }, { key: 'bonusWeaponAttack', label: 'Weapon attack' }, { key: 'bonusWeaponDamage', label: 'Weapon damage' }, { key: 'bonusSavingThrow', label: 'Saving throws' }, { key: 'bonusSpellAttack', label: 'Spell attack' }, { key: 'bonusSpellSaveDc', label: 'Spell save DC' }, { key: 'bonusSpellDamage', label: 'Spell damage' }, { key: 'bonusAc', label: 'AC' }] as const;
  private readonly inventoryRevision = signal(0);
  readonly visibleInventory = computed(() => {
    this.inventoryRevision();
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.inventoryFilter();
    return rankSearchResults(this.inventory().filter(item => item.name.toLowerCase().includes(query) && (filter === 'all' || filter === 'equipped' && item.isEquipped || filter === 'attuned' && item.isAttuned)), query, item => item.name);
  });
  readonly inventoryGroups = computed(() => {
    const groups = new Map<string, InventoryItem[]>();
    for (const item of this.visibleInventory()) {
      const label = item.entity?.itemType?.trim() || (item.isDummy ? 'Custom Items' : 'Other Items');
      const entries = groups.get(label) ?? [];
      entries.push(item);
      groups.set(label, entries);
    }
    return [...groups].map(([label, items]) => ({ label, items }))
      .sort((a, b) => compareSearchMatches(a.items[0].name, b.items[0].name, this.searchQuery()) || a.label.localeCompare(b.label));
  });
  itemKey(item: InventoryItem) { return 'item-' + (item.editorId ?? this.helpers.sourceId(item.name + '-' + (item.source ?? ''))); }
  private readonly dialogs = inject(AppDialogService);
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
  
  // Shared catalog dialog state
  isAddingItem = signal(false);
  
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
      if (!targetId || (!targetId.startsWith('item-'))) return;
      const target = this.characterData()?.inventory?.find(item => `item-${item.editorId ?? this.helpers.sourceId(item.name + '-' + (item.source ?? ''))}` === targetId);
      if (target) { this.searchQuery.set(''); this.inventoryFilter.set('all'); this.expandedItems.set(new Set([this.itemKey(target)])); }
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

  get attunedCount() { return this.inventory().filter(item => item.isAttuned).length; }

  toggleEquipped(item: InventoryItem) {
    item.isEquipped = !item.isEquipped;
    this.inventoryChanged();
  }

  toggleAttuned(item: any) {
    item.isAttuned = !item.isAttuned;
    this.inventoryChanged();
  }

  toggleExpanded(id: string) {
    this.expandedItems.set(this.isExpanded(id) ? new Set() : new Set([id]));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  requiresAttunement(item: InventoryItem): boolean {
    const reqAttune = item.entity?.item?.['reqAttune'];
    return !!reqAttune && reqAttune !== 'false';
  }

  getItemProp<K extends keyof ItemEntity>(item: InventoryItem, prop: K): ItemEntity[K] | null {
    if (!item.entity?.item) return null;
    return item.entity.item[prop];
  }

  hasItemStatistics(item: InventoryItem): boolean {
    return (['dmg1', 'range', 'scfType'] as const).some(prop => !!this.getItemProp(item, prop))
      || !!(this.getItemProp(item, 'ac') ?? item.entity?.ac)
      || (['weight', 'value'] as const).some(prop => this.getItemProp(item, prop) != null);
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

  getItemEntries(item: InventoryItem): Entry[] {
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



  getItemTypeTags(item: InventoryItem): string[] {
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
        if (check.label === 'Weapon' && /weapon/i.test(item.entity?.itemType ?? '')) continue;
        tags.push(check.label);
      }
    }

    return tags;
  }

  hasAnyBonus(item: InventoryItem): boolean {
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

  updateItemNotes(item: any, event: FeatureNotes[]): void {
    item.notes = event;
  }

  updateItemCount(item: any, value: string) {
    const numValue = Math.max(0, parseInt(value) || 0);
    item.count = numValue;
    this.inventoryChanged();
  }

  inventoryChanged() {
    this.inventoryRevision.update(value => value + 1);
    const sheet = this.characterData();
    if (sheet) this.store.setCharacter({ ...sheet, inventory: [...(sheet.inventory ?? [])] });
  }

  async deleteItem(item: InventoryItem) {
    const reopen = this.isExpanded(this.itemKey(item));
    this.expandedItems.set(new Set());
    const annotations = item.uses?.length || item.notes?.length ? ' Its uses and notes will also be removed.' : '';
    if (!await this.dialogs.confirm(`Delete "${item.name}" from this character?${annotations}`, 'Delete Item', 'Delete')) {
      if (reopen) this.expandedItems.set(new Set([this.itemKey(item)]));
      return;
    }

    const charData = this.characterData();
    if (!charData?.inventory) return;

    const index = charData.inventory.indexOf(item);
    if (index > -1) {
      charData.inventory.splice(index, 1);
      this.inventoryChanged();
    }
  }
}
