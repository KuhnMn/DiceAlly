import { Component, computed, input } from '@angular/core';
import { Companion, isObjectCompanion } from '../models/companions';
import type { RuleDescriptionSnapshot } from '../models/character-references';
import { MonsterStatBlockComponent } from './monster-stat-block.component';
import { ObjectStatBlockComponent } from './object-stat-block.component';

@Component({
  selector: 'app-companion-stat-block',
  host: { class: 'block min-w-0' },
  imports: [MonsterStatBlockComponent, ObjectStatBlockComponent],
  template: `
    @if (object(); as value) { <app-object-stat-block [value]="value" [compact]="compact()" [showSummary]="showSummary()" [senseDescriptions]="senseDescriptions()" /> }
    @if (monster(); as value) { <app-monster-stat-block [value]="value" [compact]="compact()" [showSummary]="showSummary()" [senseDescriptions]="senseDescriptions()" /> }
  `,
})
export class CompanionStatBlockComponent {
  readonly value = input.required<Companion>();
  readonly compact = input(false);
  readonly showSummary = input(true);
  readonly senseDescriptions = input<readonly RuleDescriptionSnapshot[]>([]);
  readonly object = computed(() => { const value = this.value(); return isObjectCompanion(value) ? value : undefined; });
  readonly monster = computed(() => { const value = this.value(); return isObjectCompanion(value) ? undefined : value; });
}
