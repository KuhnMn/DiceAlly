import { Component, input, output, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureUses } from '../models/character.model';

@Component({
  selector: 'app-feature-uses',
  imports: [CommonModule],
  template: `
    <div 
      class="feature-uses bg-surface-variant border border-outline-variant rounded-lg p-3 cursor-pointer hover:bg-surface-container-high transition-colors mb-2"
      (click)="addOneUse()"
    >
      @if (uses()) {
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-on-surface">
            {{ tag() }}
          </span>
          <span class="text-xs text-on-surface-variant">
            {{ totalCount() - usedCount() }} / {{ totalCount() }}
          </span>
        </div>

        <!-- Visual progress bar -->
        <div class="w-full bg-surface-container-low rounded-full h-2 mb-3">
          <div
            class="bg-primary h-2 rounded-full transition-all"
            [style.width.%]="progressPercent()"
          ></div>
        </div>

        <!-- Checkboxes for tracking -->
        @if (totalCount() > 0) {
          <div class="flex flex-wrap gap-2" (click)="$event.stopPropagation()">
            @for (index of availableUses(); track index) {
              <label class="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="index < usedCount()"
                  (change)="toggleUse(index)"
                  class="w-4 h-4 text-primary border-outline-variant rounded focus:ring-2 focus:ring-primary accent-primary"
                />
                <span class="ml-1 text-sm text-on-surface-variant">{{ index + 1 }}</span>
              </label>
            }
          </div>
        } @else {
          <p class="text-xs text-on-surface-variant italic">No uses available</p>
        }

        <!-- Regain condition (optional) -->
        @if (regainCondition()) {
          <div class="text-xs text-on-surface-variant mt-2" (click)="$event.stopPropagation()">
            Regain: {{ regainCondition() }}
          </div>
        }
      } @else {
        <p class="text-xs text-on-surface-variant italic">No uses data</p>
      }
    </div>
  `,
})
export class FeatureUsesComponent {
  uses = input<FeatureUses | undefined>(undefined);
  usesUpdated = output<{ usedFreeUses: number; tag?: string }>();

  // Local state to track used count - updates immediately for better UX
  private localUsedCount = signal(0);

  tag = computed(() => this.uses()?.tag ?? 'Uses');
  totalCount = computed(() => this.uses()?.totalFreeUses ?? 1);
  usedCount = computed(() => this.localUsedCount());
  regainCondition = computed(() => this.uses()?.freeUsesRegainCondition);

  // Sync local state with input whenever uses data changes
  constructor() {
    effect(() => {
      const uses = this.uses();
      if (uses) {
        this.localUsedCount.set(uses.usedFreeUses ?? 0);
      }
    });
  }

  availableUses = computed(() => {
    const total = this.totalCount();
    return Array.from({ length: total }, (_, i) => i);
  });

  progressPercent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return (this.usedCount() / total) * 100;
  });

  toggleUse(index: number) {
    const uses = this.uses();
    if (!uses) return;

    const isCurrentlyUsed = index < this.usedCount();
    const newUsedCount = isCurrentlyUsed ? index : index + 1;

    // Update local state immediately for instant UI feedback
    this.localUsedCount.set(newUsedCount);

    // Emit to parent to update the model
    this.usesUpdated.emit({
      usedFreeUses: newUsedCount,
      tag: uses.tag,
    });
  }

  addOneUse() {
    const uses = this.uses();
    if (!uses) return;

    const newUsedCount = Math.min(this.usedCount() + 1, this.totalCount());
    this.localUsedCount.set(newUsedCount);

    this.usesUpdated.emit({
      usedFreeUses: newUsedCount,
      tag: uses.tag,
    });
  }
}
