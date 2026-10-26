import { rankSearchResults } from '../search-ranking';
import { ListControlsComponent } from '../list-controls.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
import { UiIconComponent } from '../ui-icon.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { MonsterPresentation } from './monster-presentation';
import { FeatureUsesComponent } from './feature-uses.component';
import { CompanionHealthActionsComponent } from './companion-health-actions.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { Component, computed, input, output, TemplateRef, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ExportedCharacter,
  Monster,
} from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';
import { Companion, COMPANION_TYPES, CompanionType, companionHitPoints, companionBaseHitPoints, isObjectCompanion, objectTypeName } from '../models/companions';
import { CompanionStatBlockComponent } from './companion-stat-block.component';
import { ObjectStatBlockComponent } from './object-stat-block.component';

@Component({
  selector: 'app-monsters-page',
  imports: [CompanionHealthActionsComponent, CompanionStatBlockComponent, ObjectStatBlockComponent, ListControlsComponent, SheetListLayoutComponent, SheetDetailDialogComponent, HorizontalRowDirective, UiIconComponent, CommonModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent],
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
  templateUrl: './monsters-page.component.html',
})
export class MonstersPageComponent extends MonsterPresentation {
  /** Render the same source dialog in place, without mounting the catalog or consuming navigation. */
  readonly detailEntry = input<Companion | null>(null);
  readonly detailNavigation = input<TemplateRef<unknown> | null>(null);
  readonly detailClosed = output<void>();
  closeDetail(id: string) {
    if (this.detailEntry()) this.detailClosed.emit();
    else this.toggleExpanded(id);
  }

  readonly companionTypes = COMPANION_TYPES;
  readonly companionType = signal<CompanionType>('monster');
  readonly health = companionHitPoints;
  readonly baseHitPoints = companionBaseHitPoints;
  objectCompanion(value: Companion) { return isObjectCompanion(value) ? value : undefined; }
  objectType(value: Companion) { return isObjectCompanion(value) ? objectTypeName(value.entity) : undefined; }
  monsterEntity(value: Companion) { return isObjectCompanion(value) ? undefined : value.entity; }
  override getInitiative(value: Companion) { return isObjectCompanion(value) ? '—' : super.getInitiative(value); }
  setCompanionType(type: CompanionType) { this.companionType.set(type); this.searchQuery.set(''); this.monsterFilter.set('all'); this.expandedItems.set(new Set()); }
  baseHitPointsText(value: Companion) {
    if (isObjectCompanion(value)) { const hp = value.entity?.hp; return typeof hp === 'number' ? String(hp) : hp?.special ?? '—'; }
    const hp = value.entity?.hp;
    return [value.monsterMaxHP ?? hp?.average ?? 0, hp?.formula ? `(${hp.formula})` : '', hp?.special].filter(part => part !== undefined && part !== '').join(' ');
  }
  readonly searchQuery = signal('');
  readonly monsterFilter = signal<'all' | 'companions' | 'reference'>('all');
  readonly monsterFilters = [{ value: 'all', label: 'All' }, { value: 'companions', label: 'Tracked companions' }, { value: 'reference', label: 'Reference' }] as const;
  readonly visibleMonsters = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.monsterFilter();
    const entries: Companion[] = this.companionType() === 'object' ? [...this.characterData()?.objects ?? []].sort((a, b) => Number(b.hitPoints.enabled) - Number(a.hitPoints.enabled) || (a.name ?? '').localeCompare(b.name ?? '')) : this.monsters();
    return rankSearchResults(entries.filter(monster => (monster.name ?? '').toLowerCase().includes(query) && (filter === 'all' || filter === 'companions' && this.health(monster).enabled || filter === 'reference' && !this.health(monster).enabled)), query, monster => monster.name ?? '');
  });
  monsterKey(monster: Companion) { return (isObjectCompanion(monster) ? 'object-' : 'monster-') + (monster.editorId ?? this.helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? ''))); }
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  helpers = inject(CharacterHelpersService);
  expandedItems = signal<Set<string>>(new Set());
  
  highlightedId = signal<string | null>(null);

  monsters = computed(() => 
    [...(this.characterData()?.monsters ?? [])].sort((a, b) => {
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
      if (this.detailEntry()) return;
      const targetId = this.store.featureScrollTarget();
      if (!targetId || (!targetId.startsWith('monster-') && !targetId.startsWith('object-'))) return;
      const type = targetId.startsWith('object-') ? 'object' : 'monster';
      const entries: Companion[] = type === 'object' ? this.characterData()?.objects ?? [] : this.characterData()?.monsters ?? [];
      const target = entries.find(monster => this.monsterKey(monster) === targetId);
      if (target) this.companionType.set(type);
      if (target) { this.searchQuery.set(''); this.monsterFilter.set('all'); this.expandedItems.set(new Set([this.monsterKey(target)])); }
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

  updateMonsterHP(monster: Companion, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      const maxHP = this.getEffectiveMonsterMaxHP(monster);
      this.health(monster).current = Math.max(0, Math.min(numValue, maxHP ?? 0));
    }
  }

  getEffectiveMonsterMaxHP(monster: Companion): number {
    const health = this.health(monster);
    return health.maximumOverride ?? health.maximum ?? this.baseHitPoints(monster) ?? 0;
  }

  getMonsterMaxHpOverrideInput(monster: Companion): string {
    if (this.health(monster).maximumOverride !== null && this.health(monster).maximumOverride !== undefined) {
      return String(this.health(monster).maximumOverride);
    }
    return String(this.health(monster).maximum ?? this.baseHitPoints(monster) ?? 0);
  }

  onMonsterMaxHpOverrideInput(monster: Companion, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      this.health(monster).maximumOverride = this.health(monster).maximum ?? this.baseHitPoints(monster) ?? 0;
    } else {
      const numValue = Number(trimmed);
      if (Number.isFinite(numValue) && numValue > 0) {
        this.health(monster).maximumOverride = numValue;
      } else {
        this.health(monster).maximumOverride = this.health(monster).maximum ?? this.baseHitPoints(monster) ?? 0;
      }
    }
  }

  commitMonsterMaxHpOverride(monster: Companion) {
    // Adjust current HP if it exceeds new max
    const maxHP = this.getEffectiveMonsterMaxHP(monster);
    const health = this.health(monster);
    if (health.current != null && health.current > maxHP) {
      health.current = maxHP;
    }
  }

  clearMonsterMaxHpOverride(monster: Companion) {
    this.health(monster).maximumOverride = undefined;
    // Adjust current HP if it exceeds base max
    const baseMax = this.health(monster).maximum ?? this.baseHitPoints(monster) ?? 0;
    const health = this.health(monster);
    if (health.current != null && health.current > baseMax) {
      health.current = baseMax;
    }
  }

  updateMonsterTempHP(monster: Companion, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      this.health(monster).temporary = Math.max(0, numValue);
    }
  }

  clearMonsterTempHP(monster: Companion) {
    this.health(monster).temporary = 0;
  }

  toggleExpanded(id: string) {
    this.expandedItems.set(this.isExpanded(id) ? new Set() : new Set([id]));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }
}
