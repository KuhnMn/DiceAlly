import { rankSearchResults } from '../search-ranking';
import { ListControlsComponent } from '../list-controls.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { HorizontalRowDirective } from './horizontal-row.directive';
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
} from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-monsters-page',
  imports: [ListControlsComponent, SheetListLayoutComponent, SheetDetailDialogComponent, HorizontalRowDirective, UiIconComponent, CommonModule, EntryRendererComponent, FeatureUsesComponent, FeatureNotesComponent, MonsterStatBlockComponent],
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
  readonly searchQuery = signal('');
  readonly monsterFilter = signal<'all' | 'companions' | 'reference'>('all');
  readonly monsterFilters = [{ value: 'all', label: 'All' }, { value: 'companions', label: 'Tracked companions' }, { value: 'reference', label: 'Reference' }] as const;
  readonly visibleMonsters = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.monsterFilter();
    return rankSearchResults(this.monsters().filter(monster => (monster.name ?? '').toLowerCase().includes(query) && (filter === 'all' || filter === 'companions' && monster.hpEnabled || filter === 'reference' && !monster.hpEnabled)), query, monster => monster.name ?? '');
  });
  monsterKey(monster: Monster) { return 'monster-' + (monster.editorId ?? this.helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? ''))); }
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
      const targetId = this.store.featureScrollTarget();
      if (!targetId || (!targetId.startsWith('monster-'))) return;
      const target = this.characterData()?.monsters?.find(monster => `monster-${monster.editorId ?? this.helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? ''))}` === targetId);
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
    return monster.monsterMaxHP ?? monster.entity?.hp?.average ?? 0;
  }

  getMonsterMaxHpOverrideInput(monster: Monster): string {
    if (monster.monsterMaxHpOverride !== null && monster.monsterMaxHpOverride !== undefined) {
      return String(monster.monsterMaxHpOverride);
    }
    return String(monster.monsterMaxHP ?? monster.entity?.hp?.average ?? 0);
  }

  onMonsterMaxHpOverrideInput(monster: Monster, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      monster.monsterMaxHpOverride = monster.monsterMaxHP ?? monster.entity?.hp?.average ?? 0;
    } else {
      const numValue = Number(trimmed);
      if (Number.isFinite(numValue) && numValue > 0) {
        monster.monsterMaxHpOverride = numValue;
      } else {
        monster.monsterMaxHpOverride = monster.monsterMaxHP ?? monster.entity?.hp?.average ?? 0;
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
    const baseMax = monster.monsterMaxHP ?? monster.entity?.hp?.average ?? 0;
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
    this.expandedItems.set(this.isExpanded(id) ? new Set() : new Set([id]));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }
}
