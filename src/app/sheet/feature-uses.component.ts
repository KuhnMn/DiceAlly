import { RecoveryIndicatorComponent } from '../recovery-indicator.component';
import { Component, input, output, computed, effect, signal } from '@angular/core';
import { CharacterData, FeatureUses } from '../models/character.model';
import { featureUsesTotal } from '../models/uses-total';
import { UiIconComponent } from '../ui-icon.component';

type TrackerTone = 'features' | 'spells' | 'species' | 'items' | 'companions';
const TRACKER_COLORS: Record<TrackerTone, { accent: string; fill: string; buttons: string }> = {
  features: { accent: 'accent-blue', fill: 'bg-blue', buttons: 'bg-blue-container text-on-blue-container' },
  spells: { accent: 'accent-purple', fill: 'bg-purple', buttons: 'bg-purple-container text-on-purple-container' },
  species: { accent: 'accent-rose', fill: 'bg-rose', buttons: 'bg-rose-container text-on-rose-container' },
  items: { accent: 'accent-green', fill: 'bg-green', buttons: 'bg-green-container text-on-green-container' },
  companions: { accent: 'accent-teal', fill: 'bg-teal', buttons: 'bg-teal-container text-on-teal-container' },
};

@Component({
  selector: 'app-feature-uses',
  host: { class: 'block min-w-0' },
  imports: [RecoveryIndicatorComponent, UiIconComponent],
  template: `
    <div class="feature-uses" [class]="trackerOnly() ? '' : poolLayout() ? 'h-full border-2 border-surface rounded-md px-2 py-1 bg-surface-container-high' : 'h-full rounded-lg border border-outline-variant bg-surface-variant px-2 py-1'">
      @if (uses()) {
        @if (!trackerOnly()) {
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 break-words text-sm font-semibold" [class.whitespace-normal]="poolLayout()">{{ tag() }}</span>
          @if (poolLayout() && trackUses()) {
            <output class="ml-auto shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums" aria-live="polite" [attr.aria-label]="remainingCount() + ' of ' + totalCount() + ' uses remaining'">{{ remainingCount() }} / {{ totalCount() }}</output>
          }
          @if (trackUses()) {
          <div class="flex shrink-0 flex-row-reverse items-center gap-1 sm:flex-col sm:items-end">
          <app-recovery-indicator [condition]="regainCondition()" />
          </div>
          }
        </div>
        }
        @if (trackUses()) {
        @if (totalCount() > 0) {
          @if (!trackerOnly()) { <div class="mt-1 h-1 overflow-hidden rounded-full" [class]="poolLayout() ? 'hidden sm:block bg-outline-variant' : 'bg-surface-container-low'" role="progressbar" [attr.aria-label]="tag() + ' uses spent'" aria-valuemin="0" [attr.aria-valuemax]="totalCount()" [attr.aria-valuenow]="usedCount()"><div class="h-full transition-[width] duration-300 ease-out motion-reduce:transition-none" [class]="colors().fill" [style.width.%]="progressPercent()"></div></div>
          }
          @if (totalCount() < 5) {
            <div class="flex flex-wrap gap-0">
              @for (index of availableUses(); track index) {
                <label class="flex min-h-8 cursor-pointer items-center justify-center gap-1" [class.min-w-9]="poolLayout()" [class.min-w-10]="!poolLayout()">
                  <input type="checkbox" [checked]="index < usedCount()" (change)="toggleUse(index)" [attr.aria-label]="checkboxNoun() === 'slot' ? controlTag() + ' slot ' + (index + 1) + ' used' : controlTag() + ' use ' + (index + 1) + ' spent'" class="h-4 w-4" [class]="colors().accent" />
                  <span class="text-xs text-on-surface-variant">{{ index + 1 }}</span>
                </label>
              }
            </div>
          }
          @else {
              <div class="flex shrink-0 items-center gap-1 mt-1 sm:mt-0" [class.justify-end]="poolLayout() || trackerOnly()">
              <button type="button" (click)="adjustRemaining(1)" [disabled]="usedCount() === 0" [attr.aria-label]="'Restore one ' + controlTag()" class="flex min-h-6 min-w-6 items-center justify-center rounded-lg disabled:opacity-40 sm:min-h-7 sm:min-w-7" [class]="colors().buttons"><app-ui-icon name="up" /></button>
              @if (!poolLayout() && !trackerOnly()) {
              <output class="min-w-9 whitespace-nowrap text-center text-sm tabular-nums" aria-live="polite" [attr.aria-label]="remainingCount() + ' of ' + totalCount() + ' uses remaining'">{{ remainingCount() }}/{{ totalCount() }}</output>
              }
              <button type="button" (click)="adjustRemaining(-1)" [disabled]="usedCount() >= totalCount()" [attr.aria-label]="'Use one ' + controlTag()" class="flex min-h-6 min-w-6 items-center justify-center rounded-lg disabled:opacity-40 sm:min-h-7 sm:min-w-7" [class]="colors().buttons"><app-ui-icon name="down" /></button>
            </div>
          }
        } @else { <p class="my-2 text-xs text-on-surface-variant">{{ checkboxNoun() === 'slot' ? 'No slots available' : 'No uses available' }}</p> }
        }
        @if (note().trim()) {
          <div class="mt-2 flex items-start gap-1.5 border-t border-outline-variant pt-2 text-sm leading-5 text-on-surface-variant" [attr.aria-label]="tag() + ' notes'">
            <span class="inline-flex h-5 shrink-0 items-center"><app-ui-icon name="file" /></span><p class="min-w-0 whitespace-pre-wrap break-words">{{ note() }}</p>
          </div>
        }
      } @else { <p class="text-xs text-on-surface-variant">No uses data</p> }
    </div>
  `,
})
export class FeatureUsesComponent {
  readonly trackerOnly = input(false);
  readonly poolLayout = input(false);
  readonly trackUses = input(true);
  readonly note = input('');
  readonly tone = input<TrackerTone>('spells');
  readonly colors = computed(() => TRACKER_COLORS[this.tone()]);
  readonly controlLabel = input<string>();
  readonly checkboxNoun = input<'use' | 'slot'>('use');
  uses = input<FeatureUses | undefined>(undefined);
  readonly character = input<CharacterData | null | undefined>(undefined);
  usesUpdated = output<{ usedFreeUses: number; tag?: string }>();

  // Local state to track used count - updates immediately for better UX
  private localUsedCount = signal(0);

  tag = computed(() => this.uses()?.tag ?? 'Uses');
  controlTag = computed(() => this.controlLabel() ?? this.tag());
  totalCount = computed(() => featureUsesTotal(this.uses(), this.character()));
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
