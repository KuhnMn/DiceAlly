import { featureUsesTotal } from '../models/uses-total';
import { ResourceCost, resourceTotal, resourceCosts, remainingResource, spendResource } from '../models/source-resources';
import { Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { ExportedCharacter, SpellEntryFull, SpellSlot } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { preparedVersion, spellIdentity } from '../editor/spell-selection';
import { UiIconComponent } from '../ui-icon.component';
import { AppDialogService } from '../services/app-dialog.service';
import { ResourceSelectComponent, ResourceSelectOption } from './resource-select.component';

interface CastingResource {
  key: string;
  kind: 'slot' | 'use' | 'cantrip' | 'ritual' | 'resource';
  label: string;
  remaining: number;
  total: number;
  useIndex?: number;
  cost?: ResourceCost;
  pools?: CastingPool[];
  recovery?: string;
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
  imports: [UiIconComponent, ResourceSelectComponent],
  template: `
    <section aria-label="Cast spell" class="space-y-2">
      @let slots = !resource() || resource()?.kind === 'slot';
      <app-resource-select label="Casting Resource" ariaLabel="Casting resource" [value]="resource()?.key ?? ''"
        [options]="resourceOptions()" [disabled]="pending()" (changed)="setResource($event)"
        [placeholder]="resources().length ? 'Choose a Resource' : 'No Resources Available'" />
      <div class="flex min-h-16 min-w-0 items-end gap-2">
        @if (slots) {
          <app-resource-select class="min-w-0 flex-1" label="Cast Level" ariaLabel="Cast level" [value]="level() === null ? '' : '' + level()"
            [options]="levelOptions()" [disabled]="pending() || levels().length <= 1" (changed)="setLevel($event)" placeholder="No Applicable Level" />
        } @else if (resource()?.kind === 'cantrip') {
          <app-resource-select class="min-w-0 flex-1" label="Cast Level" ariaLabel="Cast level" value="0"
            [options]="levelOptions()" [selectable]="false" />
        } @else if (resource()?.kind === 'resource' || resource()?.kind === 'use') {
          <app-resource-select class="min-w-0 flex-1" label="Resource" ariaLabel="Resource balance" [value]="resource()!.key"
            [options]="usageOptions()" [selectable]="false" />
        }
        <div class="ml-auto flex shrink-0 items-end gap-2">
        @if (requiresConcentration()) {
          <button type="button" (click)="trackConcentration.set(!trackConcentration())" [disabled]="pending()" [attr.aria-pressed]="trackConcentration()" aria-label="Track concentration after casting" [title]="trackConcentration() ? 'Track Concentration After Casting: On' : 'Track Concentration After Casting: Off'"
            class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary" [class.bg-tertiary-container]="trackConcentration()" [class.text-on-tertiary-container]="trackConcentration()" [class.text-on-surface-variant]="!trackConcentration()"><app-ui-icon name="head" [filled]="trackConcentration()" /></button>
        }
        <button type="button" (click)="cast()" [disabled]="!canCast()" [attr.aria-label]="'Cast ' + spell().name" [attr.aria-describedby]="castCost() !== null ? castCostId : null" [title]="castCost() !== null ? 'Cost: ' + castCost() : 'Cast spell'"
          class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="wand" /> Cast @if (castCost() !== null) { <span [id]="castCostId" class="tabular-nums"><span class="sr-only">Cost: </span>({{ castCost() }})</span> }</button>
        </div>
      </div>
      @if (!resource() || resource()?.kind !== 'slot' || level() === null) {
      <p class="text-xs text-on-surface-variant" aria-live="polite">
        @if (baseLevel() === null) { The spell level is unavailable. }
        @else if (!resource()) { {{ resources().length ? 'Choose a casting resource.' : 'No spell slots available for this spell.' }} }
        @else if (resource()?.kind === 'use') { Uses one selected use; no spell slot. }
        @else if (resource()?.kind === 'resource') { Uses the selected resource; no spell slot. }
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
  readonly castCostId = 'cast-cost-' + crypto.randomUUID();
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
        label: source + ' · Spell Slots' + (ordinal ? ' · Pool ' + (ordinal + 1) : '') }];
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
        resources.set(pool.key, { key: pool.key, kind: 'slot', label: pool.label, recovery: pool.slot.regainCondition || 'LONG_REST', remaining: pool.remaining, total: pool.slot.total, pools: [pool] });
      }
    }
    return [...resources.values()];
  }
  readonly resources = (): CastingResource[] => [
    ...(this.baseLevel() === 0 ? [{ key: 'cantrip', kind: 'cantrip' as const, label: 'Cantrip · No Resource', remaining: 1, total: 1 }] : []),
    ...(this.baseLevel() === 0 ? [] : this.slotResources()),
    ...resourceCosts(this.liveSheet() ?? {}, (this.trackedSpell()?.spell ?? this.spell()).resourceLinks).map(cost => {
      const pool = this.liveSheet()!.resources!.find(resource => resource.id === cost.resourceId)!;
      const source = this.liveSheet()!.character?.featureSources?.find(source => source.editorId === pool.sourceId);
      return {key:'resource:' + pool.id,kind:'resource' as const,label:(source?.name || 'Removed source') + ' · ' + pool.name,remaining:remainingResource(pool, this.liveSheet()!),total:resourceTotal(pool, this.liveSheet()!),cost,
        recovery:pool.recovery === 'NONE' ? 'MANUAL' : pool.recovery};
    }),
    ...(this.spell().entity?.meta?.ritual === true ? [{ key: 'ritual', kind: 'ritual' as const, label: 'Ritual - Free', remaining: 1, total: 1 }] : []),
    ...(this.trackedSpell()?.spell.uses ?? []).flatMap((use, index) => {
      const total = featureUsesTotal(use, this.liveSheet()?.character), used = use.used ?? 0;
      if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(used) || used < 0) return [];
      return [{ key: 'use:' + index, kind: 'use' as const, label: (this.spell().castingSourceName || 'Unassigned Source') + ' · ' + (use.tag || 'Uses'), remaining: Math.max(0, total - used), total, useIndex: index }];
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
  resourceOptions(): ResourceSelectOption[] {
    return this.resources().map(resource => ({ value: resource.key, label: resource.label,
      recovery: resource.recovery }));
  }
  usageOptions(): ResourceSelectOption[] {
    const resource = this.resource();
    if (!resource || (resource.kind !== 'resource' && resource.kind !== 'use')) return [];
    const name = resource.kind === 'resource'
      ? this.liveSheet()?.resources?.find(pool => pool.id === resource.cost?.resourceId)?.name ?? 'Missing resource'
      : this.trackedSpell()?.spell.uses?.[resource.useIndex!]?.tag || 'Uses';
    return [{ value: resource.key, label: name, balance: `${resource.remaining}/${resource.total}` }];
  }
  levelOptions(): ResourceSelectOption[] {
    return this.levels().map(value => {
      const pool = this.poolForLevel(value);
      return { value: String(value), label: value === 0 ? 'Cantrip' : `Level ${value}`,
        balance: pool ? `${pool.remaining}/${pool.slot.total}` : undefined };
    });
  }
  readonly upcasting = () => this.resource()?.kind === 'slot' && this.level()! > this.baseLevel()!;
  castCost(): number | null {
    const resource = this.resource();
    return resource?.kind === 'resource' ? resource.cost!.amount : resource?.kind === 'use' ? 1 : null;
  }
  private available() {
    const resource = this.resource();
    const remaining = resource?.kind === 'slot' ? this.pool()?.remaining ?? 0 : resource?.remaining ?? 0;
    return !!this.liveSheet()?.character && this.level() !== null && this.levels().includes(this.level()!)
      && (resource?.kind === 'resource' ? remaining >= resource.cost!.amount : remaining > 0)
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

  private castConfirmation(resource: CastingResource, level: number | null): string {
    const cast = `Cast ${this.spell().name}`;
    switch (resource.kind) {
      case 'slot': return `${cast} at Level ${level}.`;
      case 'cantrip': return `${cast} as a cantrip.`;
      case 'ritual': return `${cast} as a ritual.`;
      case 'use': {
        const tag = this.trackedSpell()?.spell.uses?.[resource.useIndex!]?.tag;
        return `${cast} using ${tag ? `${tag} (1 use)` : '1 use'}.`;
      }
      case 'resource': return `${cast} using ${this.usageOptions()[0].label} (Cost: ${resource.cost!.amount}).`;
    }
  }

  async cast() {
    if (!this.canCast()) return;
    const spellKey = this.spellKey(), resourceKey = this.resource()!.key, level = this.level();
    const resourceLabel = this.resource()!.label, resourceTotal = this.resource()!.total;
    const resourceCost = JSON.stringify(this.resource()?.cost);
    const concentration = this.requiresConcentration(), track = this.trackConcentration();
    const stillCurrent = () => !this.destroyed && this.available() && spellKey === this.spellKey() && resourceKey === this.resource()?.key && level === this.level()
      && resourceLabel === this.resource()?.label && resourceTotal === this.resource()?.total && JSON.stringify(this.resource()?.cost) === resourceCost;
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
      const confirmation = this.castConfirmation(resource, level);
      let next = data;
      if (resource.kind === 'slot') {
        const pool = this.pool()!, slots = data.character!.spellSlots![pool.source]
          .map((slot, index) => index === pool.index ? { ...slot, used: (slot.used ?? 0) + 1 } : slot);
        next = { ...data, character: { ...data.character!, spellSlots: { ...data.character!.spellSlots, [pool.source]: slots } } };
      } else if (resource.kind === 'resource') {
        const spent = spendResource(data, resource.cost!); if (!spent) return; next = spent;
      } else if (resource.kind === 'use') {
        const tracked = this.trackedSpell();
        if (!tracked) return;
        const uses = tracked.spell.uses!.map((use, index) => index === resource.useIndex ? { ...use, used: (use.used ?? 0) + 1 } : use);
        next = { ...data, spells: data.spells!.map((spell, index) => index === tracked.index ? { ...spell, uses } : spell) };
      }
      if (concentration && track) next = { ...next, character: { ...next.character!, concentrationEffect: this.spell().name } };
      if (next !== data) this.store.setCharacter(next);
      this.feedback.set(confirmation);
    } finally { this.pending.set(false); }
  }
}
