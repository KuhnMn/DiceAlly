import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { ExportedCharacter, SpellEntryFull, SpellSlot } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { spellIdentity } from '../editor/spell-selection';
import { regainLabel } from './regain-label';
import { UiIconComponent } from '../ui-icon.component';

interface CastingPool {
  key: string;
  source: string;
  index: number;
  slot: SpellSlot;
  remaining: number;
  label: string;
}

/** A slot is spent only on an explicit cast, using the latest sheet state. */
@Component({
  selector: 'app-spell-cast-control',
  host: { class: 'block border-t border-outline-variant pt-3' },
  imports: [UiIconComponent],
  template: `
    <section aria-label="Cast spell" class="space-y-2">
      <div class="flex flex-wrap items-end gap-2">
        <label class="min-w-24 flex-1 text-xs font-semibold text-on-surface-variant">Cast Level
          <select aria-label="Cast level" [value]="level() ?? ''" [disabled]="baseLevel() === null || baseLevel() === 0" (change)="setLevel($any($event.target).value)"
            class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-3 text-base text-on-surface disabled:opacity-60 sm:text-sm">
            @for (value of levels(); track value) { <option [value]="value">{{ value === 0 ? 'C' : 'Level ' + value }}</option> }
          </select>
        </label>
        <button type="button" (click)="cast()" [disabled]="!canCast()" [attr.aria-label]="'Cast ' + spell().name"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="wand" /> Cast</button>
      </div>
      @if (pools().length > 1) {
        <label class="block text-xs font-semibold text-on-surface-variant">Spell Slots
          <select aria-label="Spell slot pool" [value]="pool()?.key ?? ''" (change)="selectedPool.set($any($event.target).value); feedback.set('')"
            class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm">
            @for (pool of pools(); track pool.key) { <option [value]="pool.key">{{ pool.label }} · {{ pool.remaining }} / {{ pool.slot.total }} available</option> }
          </select>
        </label>
      }
      <p class="text-xs text-on-surface-variant" aria-live="polite">
        @if (baseLevel() === 0) { Cantrips do not use spell slots. }
        @else if (baseLevel() === null) { The spell level is unavailable. }
        @else if (pool(); as pool) { {{ pool.label }} · {{ pool.remaining }} / {{ pool.slot.total }} available }
        @else { No spell slots available at this level. }
      </p>
      @if (feedback()) { <p role="status" class="text-sm text-primary">{{ feedback() }}</p> }
    </section>
  `,
})
export class SpellCastControlComponent {
  readonly spell = input.required<SpellEntryFull>();
  readonly sheet = input.required<ExportedCharacter>();
  private readonly store = inject(CharacterStore);
  readonly baseLevel = computed(() => {
    const value = this.spell().entity?.level;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9 ? value : null;
  });
  private readonly spellKey = computed(() => JSON.stringify([this.spell().editorId ?? spellIdentity(this.spell()), this.baseLevel()]));
  readonly level = linkedSignal<number | null>(() => { this.spellKey(); return this.baseLevel(); });
  readonly selectedPool = linkedSignal<string | null>(() => { this.spellKey(); return null; });
  readonly feedback = signal('');
  readonly levels = computed(() => {
    const base = this.baseLevel();
    return base === null ? [] : base === 0 ? [0] : Array.from({ length: 10 - base }, (_, i) => base + i);
  });
  private readonly liveSheet = computed(() => {
    const bound = this.sheet(), current = this.store.characterData();
    if (!current || current === bound) return current ?? bound;
    const id = bound.character?.characterUuid;
    return id && id === current.character?.characterUuid ? current : null;
  });
  readonly pools = computed<CastingPool[]>(() => {
    const level = this.level();
    if (level === null || level === 0) return [];
    return Object.entries(this.liveSheet()?.character?.spellSlots ?? {}).flatMap(([source, slots]) => slots.flatMap((slot, index) => {
      if (slot.level !== level || !Number.isSafeInteger(slot.total) || slot.total <= 0 || !Number.isSafeInteger(slot.used ?? 0) || (slot.used ?? 0) < 0) return [];
      return [{ key: JSON.stringify([source, index]), source, index, slot, remaining: Math.max(0, slot.total - (slot.used ?? 0)),
        label: source + ' · ' + regainLabel(slot.regainCondition) }];
    }));
  });
  readonly pool = computed<CastingPool | null>(() => {
    const pools = this.pools();
    return pools.find(pool => pool.key === this.selectedPool())
      ?? pools.find(pool => pool.source === this.spell().castingSourceName)
      ?? pools.find(pool => pool.remaining > 0) ?? pools[0] ?? null;
  });
  readonly canCast = computed(() => this.baseLevel() === 0 || !!this.liveSheet() && this.level() !== null && this.levels().includes(this.level()!)
    && (this.level() === 0 || (this.pool()?.remaining ?? 0) > 0));

  constructor() { effect(() => { this.spellKey(); this.feedback.set(''); }); }

  setLevel(value: string) {
    if (this.baseLevel() === 0) return;
    const level = Number(value);
    this.level.set(value.trim() && this.levels().includes(level) ? level : null);
    this.feedback.set('');
  }

  cast() {
    if (this.baseLevel() === 0 || !this.canCast()) return;
    const data = this.liveSheet(), pool = this.pool();
    if (!data?.character?.spellSlots || !pool || pool.remaining <= 0) return;
    // Preserve other levels and recovery pools, including pools at the same level.
    const slots = data.character.spellSlots[pool.source].map((slot, index) => index === pool.index ? { ...slot, used: (slot.used ?? 0) + 1 } : slot);
    this.store.setCharacter({ ...data, character: { ...data.character,
      spellSlots: { ...data.character.spellSlots, [pool.source]: slots } } });
    this.feedback.set(`Cast ${this.spell().name} at Level ${this.level()}.`);
  }
}
