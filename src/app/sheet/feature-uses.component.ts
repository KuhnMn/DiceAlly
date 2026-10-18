import { RecoveryIndicatorComponent } from '../recovery-indicator.component';
import { Component, input, output, computed, effect, signal } from '@angular/core';
import { FeatureUses } from '../models/character.model';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-feature-uses',
  host: { class: 'block min-w-0' },
  imports: [RecoveryIndicatorComponent, UiIconComponent],
  template: `
    <div class="feature-uses h-full rounded-lg border border-outline-variant bg-surface-variant px-2 py-1 sm:py-2">
      @if (uses()) {
        <div class="flex items-center justify-between gap-1 sm:gap-2">
          <span class="min-w-0 break-words text-sm font-semibold">{{ tag() }}</span>
          <div class="flex shrink-0 flex-row-reverse items-center gap-1 sm:flex-col sm:items-end">
          <app-recovery-indicator [condition]="regainCondition()" />
          </div>
        </div>
        @if (totalCount() > 0) {
          <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-container-low sm:mb-1" role="progressbar" [attr.aria-label]="tag() + ' uses spent'" aria-valuemin="0" [attr.aria-valuemax]="totalCount()" [attr.aria-valuenow]="usedCount()"><div class="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" [style.width.%]="progressPercent()"></div></div>
          @if (totalCount() <= 5) {
            <div class="flex flex-wrap gap-0">
              @for (index of availableUses(); track index) {
                <label class="flex min-h-8 min-w-10 cursor-pointer items-center justify-center gap-1 sm:min-h-9">
                  <input type="checkbox" [checked]="index < usedCount()" (change)="toggleUse(index)" [attr.aria-label]="tag() + ' use ' + (index + 1) + ' spent'" class="h-4 w-4 accent-primary" />
                  <span class="text-xs text-on-surface-variant">{{ index + 1 }}</span>
                </label>
              }
            </div>
          }
          @else {
              <div class="flex shrink-0 items-center gap-1 mt-1 sm:mt-0">
              <button type="button" (click)="adjustRemaining(-1)" [disabled]="usedCount() >= totalCount()" [attr.aria-label]="'Use one ' + tag()" class="flex min-h-6 min-w-6 items-center justify-center rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40 sm:min-h-7 sm:min-w-7"><app-ui-icon name="down" /></button>
              <output class="min-w-9 whitespace-nowrap text-center text-sm tabular-nums" aria-live="polite" [attr.aria-label]="remainingCount() + ' of ' + totalCount() + ' uses remaining'">{{ remainingCount() }}/{{ totalCount() }}</output>
              <button type="button" (click)="adjustRemaining(1)" [disabled]="usedCount() === 0" [attr.aria-label]="'Restore one ' + tag()" class="flex min-h-6 min-w-6 items-center justify-center rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40 sm:min-h-7 sm:min-w-7"><app-ui-icon name="up" /></button>
            </div>
          }
        } @else { <p class="my-2 text-xs text-on-surface-variant">No uses available</p> }
      } @else { <p class="text-xs text-on-surface-variant">No uses data</p> }
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
  usedCount = computed(() => Math.max(0, Math.min(this.localUsedCount(), this.totalCount())));
  remainingCount = computed(() => this.totalCount() - this.usedCount());
  // Match RestService: older trackers without an explicit condition recover on a long rest.
  regainCondition = computed(() => this.uses()?.freeUsesRegainCondition || 'LONG_REST');

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
    const isCurrentlyUsed = index < this.usedCount();
    const newUsedCount = isCurrentlyUsed ? index : index + 1;
    this.setUsedCount(newUsedCount);
  }

  addOneUse() {
    this.adjustRemaining(-1);
  }

  adjustRemaining(delta: -1 | 1) {
    this.setUsedCount(this.usedCount() - delta);
  }

  private setUsedCount(count: number) {
    const uses = this.uses();
    if (!uses) return;
    const newUsedCount = Math.max(0, Math.min(count, this.totalCount()));
    if (newUsedCount === this.usedCount()) return;
    this.localUsedCount.set(newUsedCount);

    this.usesUpdated.emit({
      usedFreeUses: newUsedCount,
      tag: uses.tag,
    });
  }
}
