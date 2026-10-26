import { Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { ExportedCharacter, SpellEntryFull, SpellSlot } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { preparedVersion, spellIdentity } from '../editor/spell-selection';
import { regainLabel } from './regain-label';
import { UiIconComponent } from '../ui-icon.component';
import { AppDialogService } from '../services/app-dialog.service';

interface CastingResource {
  key: string;
  kind: 'slot' | 'use' | 'cantrip' | 'ritual';
  label: string;
  remaining: number;
  total: number;
  useIndex?: number;
  pools?: CastingPool[];
}

interface CastingPool {
  key: string;
  source: string;
  index: number;
  slot: SpellSlot;
  remaining: number;
  label: string;
}

/** Spend exactly the selected resource after confirmation, using the latest sheet state. */
@Component({
  selector: 'app-spell-cast-control',
  host: { class: 'block border-t border-outline-variant pt-3' },
  imports: [UiIconComponent],
  template: `
    <section aria-label="Cast spell" class="space-y-2">
      <label class="block text-xs font-semibold text-on-surface-variant">Casting Resource
        <select aria-label="Casting resource" [value]="resource()?.key ?? ''" [disabled]="pending()" (change)="setResource($any($event.target).value)"
          class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm">
          @if (!resource()) { <option value="">{{ resources().length ? 'Choose a Resource' : 'No Resources Available' }}</option> }
          @for (resource of resources(); track resource.key) { <option [value]="resource.key">{{ resource.label }}@if (resource.kind === 'use') { · {{ resource.remaining }} / {{ resource.total }} available }</option> }
        </select>
      </label>
      <div class="flex flex-wrap items-end gap-2">
        <label class="min-w-24 flex-1 text-xs font-semibold text-on-surface-variant">Cast Level
          <select aria-label="Cast level" [value]="level() ?? ''" [disabled]="pending() || levels().length <= 1" (change)="setLevel($any($event.target).value)"
            class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-3 text-base text-on-surface disabled:opacity-60 sm:text-sm">
            @if (level() === null) { <option value="">No Applicable Level</option> }
            @for (value of levels(); track value) { <option [value]="value">{{ value === 0 ? 'C' : 'Level ' + value }}@if (poolForLevel(value); as pool) { · {{ pool.remaining }} / {{ pool.slot.total }} available }</option> }
          </select>
        </label>
        @if (requiresConcentration()) {
          <button type="button" (click)="trackConcentration.set(!trackConcentration())" [disabled]="pending()" [attr.aria-pressed]="trackConcentration()" aria-label="Track concentration after casting" [title]="trackConcentration() ? 'Track Concentration After Casting: On' : 'Track Concentration After Casting: Off'"
            class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary" [class.bg-tertiary-container]="trackConcentration()" [class.text-on-tertiary-container]="trackConcentration()" [class.text-on-surface-variant]="!trackConcentration()"><app-ui-icon name="head" [filled]="trackConcentration()" /></button>
        }
        <button type="button" (click)="cast()" [disabled]="!canCast()" [attr.aria-label]="'Cast ' + spell().name"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="wand" /> Cast</button>
      </div>
      @if (!resource() || resource()?.kind !== 'slot' || level() === null) {
      <p class="text-xs text-on-surface-variant" aria-live="polite">
        @if (baseLevel() === null) { The spell level is unavailable. }
        @else if (!resource()) { {{ resources().length ? 'Choose a casting resource.' : 'No spell slots available for this spell.' }} }
        @else if (resource()?.kind === 'use') { Uses one selected use; no spell slot. Cast at the spell's base level. }
        @else if (resource()?.kind === 'ritual') { Ritual casting uses no spell slot or Uses. }
        @else if (baseLevel() === 0) { Cantrips do not use spell slots. }
        @else { Choose an applicable cast level. }
      </p>
      }
      @if (feedback()) { <p role="status" class="text-sm text-primary">{{ feedback() }}</p> }
    </section>
  `,
})
export class SpellCastControlComponent {
  readonly spell = input.required<SpellEntryFull>();
  readonly sheet = input.required<ExportedCharacter>();
  private readonly store = inject(CharacterStore);
  private readonly dialogs = inject(AppDialogService);
  private destroyed = false;
  readonly pending = signal(false);
  readonly trackConcentration = linkedSignal(() => { this.spellKey(); return true; });
  readonly requiresConcentration = computed(() => this.spell().entity?.duration?.some(duration => duration.concentration === true) ?? false);
  readonly baseLevel = computed(() => {
    const value = this.spell().entity?.level;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9 ? value : null;
  });
  private readonly spellKey = computed(() => JSON.stringify([this.spell().editorId ?? spellIdentity(this.spell()), this.baseLevel()]));
  private readonly selectedLevel = linkedSignal<number | null | undefined>(() => { this.spellKey(); return undefined; });
  readonly level = (): number | null => {
    const selected = this.selectedLevel(), levels = this.levels();
    if (selected === undefined) return levels[0] ?? null;
    return selected !== null && levels.includes(selected) ? selected : null;
  };
  readonly selectedPool = linkedSignal<string | null>(() => { this.spellKey(); return null; });
  readonly feedback = signal('');
  readonly levels = (): number[] => {
    const base = this.baseLevel();
    const resource = this.resource();
    if (base === null || !resource) return [];
    if (resource.kind !== 'slot') return [base];
    if (base === 0) return [];
    return [...new Set(resource.pools!.filter(pool => pool.slot.level >= base).map(pool => pool.slot.level))].sort((a, b) => a - b);
  };
  private readonly liveSheet = computed(() => {
    const bound = this.sheet(), current = this.store.characterData();
    if (!current || current === bound) return current ?? bound;
    const id = bound.character?.characterUuid;
    return id && id === current.character?.characterUuid ? current : null;
  });
  // The existing trackers edit counts in place; read availability again for every view/cast.
  readonly pools = (): CastingPool[] => {
    return Object.entries(this.liveSheet()?.character?.spellSlots ?? {}).flatMap(([source, slots]) => slots.flatMap((slot, index) => {
      if (!Number.isInteger(slot.level) || slot.level < 1 || slot.level > 9 || !Number.isSafeInteger(slot.total) || slot.total <= 0 || !Number.isSafeInteger(slot.used ?? 0) || (slot.used ?? 0) < 0) return [];
      // Identify the resource independently of its level's position in the saved slot array.
      const recovery = slot.regainCondition || 'LONG_REST';
      const ordinal = slots.slice(0, index).filter(previous => previous.level === slot.level && (previous.regainCondition || 'LONG_REST') === recovery).length;
      return [{ key: JSON.stringify([source, recovery, ordinal]), source, index, slot, remaining: Math.max(0, slot.total - (slot.used ?? 0)),
        label: source + ' · ' + regainLabel(slot.regainCondition) + (ordinal ? ' · Pool ' + (ordinal + 1) : '') }];
    }));
  };
  readonly poolForLevel = (level: number): CastingPool | null => this.resource()?.pools?.find(pool => pool.slot.level === level) ?? null;
  readonly pool = (): CastingPool | null => this.level() === null ? null : this.poolForLevel(this.level()!);
  private readonly trackedSpell = () => {
    const entry = this.spell(), spells = this.liveSheet()?.spells ?? [];
    const exactIndex = spells.indexOf(entry);
    if (exactIndex >= 0) return { spell: spells[exactIndex], index: exactIndex };
    const matches = spells.map((spell, index) => ({ spell, index }))
      .filter(({ spell }) => entry.editorId ? spell.editorId === entry.editorId
        : spellIdentity(spell) === spellIdentity(entry) && spell.listType === entry.listType);
    return matches.length === 1 ? matches[0] : null;
  };
  private slotResources(): CastingResource[] {
    const resources = new Map<string, CastingResource>();
    for (const pool of this.pools()) {
      const resource = resources.get(pool.key);
      if (resource) {
        resource.pools!.push(pool); resource.remaining += pool.remaining; resource.total += pool.slot.total;
      } else {
        resources.set(pool.key, { key: pool.key, kind: 'slot', label: pool.label, remaining: pool.remaining, total: pool.slot.total, pools: [pool] });
      }
    }
    return [...resources.values()];
  }
  readonly resources = (): CastingResource[] => [
    ...(this.baseLevel() === 0 ? [{ key: 'cantrip', kind: 'cantrip' as const, label: 'Cantrip · No Resource', remaining: 1, total: 1 }] : []),
    ...this.slotResources(),
    ...(this.spell().entity?.meta?.ritual === true ? [{ key: 'ritual', kind: 'ritual' as const, label: 'Ritual - Free', remaining: 1, total: 1 }] : []),
    ...(this.trackedSpell()?.spell.uses ?? []).flatMap((use, index) => {
      const total = use.totalFreeUses ?? 1, used = use.usedFreeUses ?? 0;
      if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(used) || used < 0) return [];
      return [{ key: 'use:' + index, kind: 'use' as const, label: (use.tag || 'Uses') + ' · ' + regainLabel(use.freeUsesRegainCondition), remaining: Math.max(0, total - used), total, useIndex: index }];
    }),
  ];
  readonly resource = (): CastingResource | null => {
    const selected = this.selectedPool();
    const resources = this.resources();
    if (selected !== null) return resources.find(resource => resource.key === selected) ?? null;
    return resources.find(resource => resource.kind === 'cantrip')
      ?? resources.find(resource => resource.kind === 'slot' && resource.pools?.[0].source === this.spell().castingSourceName)
      ?? resources.find(resource => resource.kind === 'slot') ?? null;
  };
  readonly upcasting = () => this.resource()?.kind === 'slot' && this.level()! > this.baseLevel()!;
  private available() {
    const resource = this.resource();
    const remaining = resource?.kind === 'slot' ? this.pool()?.remaining ?? 0 : resource?.remaining ?? 0;
    return !!this.liveSheet()?.character && this.level() !== null && this.levels().includes(this.level()!) && remaining > 0
      && (resource?.kind !== 'use' || this.level() === this.baseLevel());
  }
  readonly canCast = () => !this.pending() && this.available();
  readonly isPrepared = () => {
    const data = this.liveSheet(), spell = this.trackedSpell()?.spell ?? this.spell();
    return data?.spells ? !!preparedVersion(spell, data.spells) : spell.listType === 'PREPARED';
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; });
    effect(() => { this.spellKey(); this.feedback.set(''); });
  }

  setLevel(value: string) {
    if (this.resource()?.kind !== 'slot') return;
    const level = Number(value);
    this.selectedLevel.set(value.trim() && this.levels().includes(level) ? level : null);
    this.feedback.set('');
  }

  setResource(key: string) {
    const previousLevel = this.level();
    this.selectedPool.set(key);
    const levels = this.levels();
    this.selectedLevel.set(previousLevel !== null && levels.includes(previousLevel) ? previousLevel : levels[0] ?? null);
    this.feedback.set('');
  }

  async cast() {
    if (!this.canCast()) return;
    const spellKey = this.spellKey(), resourceKey = this.resource()!.key, level = this.level();
    const resourceLabel = this.resource()!.label, resourceTotal = this.resource()!.total;
    const concentration = this.requiresConcentration(), track = this.trackConcentration();
    const stillCurrent = () => !this.destroyed && this.available() && spellKey === this.spellKey() && resourceKey === this.resource()?.key && level === this.level()
      && resourceLabel === this.resource()?.label && resourceTotal === this.resource()?.total;
    this.pending.set(true);
    try {
      if (!this.isPrepared()) {
        if (!await this.dialogs.confirm(`${this.spell().name} is not prepared. Cast it anyway?`, 'Spell Not Prepared', 'Cast Anyway')) return;
        if (!stillCurrent()) return;
      }
      const previousEffect = this.liveSheet()?.character?.concentrationEffect;
      if (concentration && track && previousEffect) {
        const message = `You are concentrating on ${previousEffect}. End it and concentrate on ${this.spell().name}?`;
        if (!await this.dialogs.confirm(message, 'Concentration Already Active', 'Cast Spell')) return;
        if (this.liveSheet()?.character?.concentrationEffect !== previousEffect) {
          this.feedback.set('Concentration changed. Review it and cast again.'); return;
        }
      }
      // Confirm against the latest sheet only after the user decides; cancellation spends nothing.
      if (!stillCurrent()) return;
      const data = this.liveSheet()!, resource = this.resource()!;
      let next = data;
      if (resource.kind === 'slot') {
        const pool = this.pool()!, slots = data.character!.spellSlots![pool.source]
          .map((slot, index) => index === pool.index ? { ...slot, used: (slot.used ?? 0) + 1 } : slot);
        next = { ...data, character: { ...data.character!, spellSlots: { ...data.character!.spellSlots, [pool.source]: slots } } };
      } else if (resource.kind === 'use') {
        const tracked = this.trackedSpell();
        if (!tracked) return;
        const uses = tracked.spell.uses!.map((use, index) => index === resource.useIndex ? { ...use, usedFreeUses: (use.usedFreeUses ?? 0) + 1 } : use);
        next = { ...data, spells: data.spells!.map((spell, index) => index === tracked.index ? { ...spell, uses } : spell) };
      }
      if (concentration && track) next = { ...next, character: { ...next.character!, concentrationEffect: this.spell().name } };
      if (next !== data) this.store.setCharacter(next);
      if (resource.kind === 'ritual') this.feedback.set(`Cast ${this.spell().name} as a ritual.`);
      else if (resource.kind !== 'cantrip' || concentration) this.feedback.set(`Cast ${this.spell().name}${level === 0 ? '' : ' at Level ' + level}.`);
    } finally { this.pending.set(false); }
  }
}
