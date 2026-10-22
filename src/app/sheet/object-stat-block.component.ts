import { Component, computed, input } from '@angular/core';
import type { ObjectCompanion } from '../models/companions';
import { formatSizeNames } from '../size-names';
import { formatSourceMovement } from '../content/species-adapter';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { MonsterPresentation } from './monster-presentation';
import { RuleReferenceComponent } from './rule-reference.component';
import type { RuleDescriptionSnapshot } from '../models/character-references';

@Component({
  selector: 'app-object-stat-block',
  imports: [EntryRendererComponent, RuleReferenceComponent],
  host: { '[class.compact]': 'compact()' },
  styleUrl: './stat-block.css',
  template: `
    @if (value().entity; as object) {
      @if (showSummary()) {
        <div [class]="summaryOnly() ? 'grid grid-cols-2 gap-2 text-sm' : 'grid grid-cols-2 lg:grid-cols-4 gap-3 my-4'" aria-label="Object statistics">
          @for (stat of summaryStats(); track stat.label) {
            <div [class]="summaryOnly() ? 'rounded-lg border border-outline-variant bg-surface-container-high p-2' : 'p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high'">
              <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">{{ stat.label }}</div>
              <div [class]="stat.label === 'HP' ? 'text-sm font-semibold text-on-surface' : summaryOnly() ? 'font-semibold' : 'text-2xl font-bold'" [class.text-primary]="!summaryOnly() && stat.label === 'AC'" [class.text-tertiary]="!summaryOnly() && stat.label === 'Size'">
                <app-entry-renderer [entry]="{text: stat.value}" [compact]="summaryOnly()" />
              </div>
            </div>
          }
        </div>
      }
      @if (!summaryOnly()) {
        <div class="mt-3 space-y-3 text-sm">
          @if (object.creatureType) { <p><strong>Creature Type:</strong> {{ object.creatureType }}</p> }
          @if (abilities().length) {
            <div class="grid grid-cols-3 lg:grid-cols-6 gap-2 my-4">
              @for (ability of abilities(); track ability.name) { <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high"><div class="text-xs uppercase font-bold text-on-surface-variant">{{ ability.name }}</div><div class="text-xl font-bold text-primary">{{ ability.score }}</div><div class="text-xs text-tertiary">{{ getModifier(ability.score) }}</div></div> }
            </div>
          }
          @for (defense of defenses(); track defense.label) {
            <div class="my-3 px-4 py-3 bg-surface border-l-4 rounded-md" [class.border-secondary]="defense.key !== 'conditionImmune'" [class.border-tertiary]="defense.key === 'conditionImmune'">
              <span class="font-bold text-sm text-on-surface mr-2">{{ defense.label }}:</span><app-entry-renderer class="text-sm text-on-surface-variant" [entry]="{text: defense.text}" [inline]="true" />
            </div>
          }
          @if (object.senses?.length) {
            <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md"><span class="font-bold text-sm text-on-surface mr-2">Senses:</span>
              @for (sense of object.senses; track $index) { <app-rule-reference class="text-sm text-on-surface-variant" [reference]="senseDescription(sense)"><span>{{ sense }}</span></app-rule-reference>@if (!$last) { <span class="text-on-surface-variant">, </span> } }
            </div>
          }
          @if (object.entries.length) {
            <section class="mt-6 pt-4 border-t border-outline-variant">
              <h4 class="font-bold text-lg mb-3 text-on-surface">Description</h4>
              <div class="my-3 px-4 py-3 bg-surface border-l-4 border-blue rounded-md text-sm leading-relaxed text-on-surface-variant"><app-entry-renderer [entries]="object.entries" [compact]="compact()" /></div>
            </section>
          }
          @if (object.actionEntries.length) {
            <section class="mt-6 pt-4 border-t border-outline-variant">
              <h4 class="font-bold text-lg mb-3 text-on-surface">Actions</h4>
              @for (action of object.actionEntries; track $index) {
                <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md text-sm leading-relaxed text-on-surface-variant"><app-entry-renderer [entry]="action" [compact]="compact()" /></div>
              }
            </section>
          }
        </div>
      }
    }
  `,
})
export class ObjectStatBlockComponent extends MonsterPresentation {
  readonly value = input.required<ObjectCompanion>();
  readonly compact = input(false);
  readonly showSummary = input(true);
  readonly showHitPoints = input(true);
  readonly summaryOnly = input(false);
  readonly senseDescriptions = input<readonly RuleDescriptionSnapshot[]>([]);
  statistic(value: number | { special: string }): string { return typeof value === 'number' ? String(value) : value.special; }
  readonly summaryStats = computed(() => {
    const definition = this.value().entity;
    if (!definition) return [];
    const stats: { label: string; value: string }[] = [];
    if (definition.ac != null) stats.push({ label: 'AC', value: this.formatArmorClass(definition.ac) });
    if (this.showHitPoints() && definition.hp != null) stats.push({ label: 'HP', value: this.statistic(definition.hp) });
    if (!this.summaryOnly()) {
      if (definition.size.length) stats.push({ label: 'Size', value: formatSizeNames(definition.size) });
      if (definition.speed != null) stats.push({ label: 'Speed', value: formatSourceMovement(definition.speed) });
    }
    return stats;
  });
  readonly abilities = computed(() => {
    const definition = this.value().entity;
    return (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).flatMap(name => {
      const score = definition?.[name];
      return score == null ? [] : [{ name, score }];
    });
  });
  readonly defenses = computed(() => {
    const definition = this.value().entity;
    return ([['immune', 'Immunities'], ['resist', 'Resistances'], ['vulnerable', 'Vulnerabilities'], ['conditionImmune', 'Condition Immunities']] as const)
      .flatMap(([key, label]) => definition?.[key]?.length ? [{ key, label, text: definition[key].map(value => this.formatDefense(value)).join(', ') }] : []);
  });
  senseDescription(text: string) { return this.senseDescriptions().find(reference => new RegExp(`^${reference.name}\\b`, 'i').test(text.trim())); }
}
