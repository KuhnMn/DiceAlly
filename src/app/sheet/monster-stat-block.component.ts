import { Component, input } from '@angular/core';
import { Monster } from '../models/character.model';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { MonsterPresentation } from './monster-presentation';
import { RuleReferenceComponent } from './rule-reference.component';
import { RuleDescriptionSnapshot, STANDARD_SENSES } from '../models/character-references';

@Component({
  selector: 'app-monster-stat-block',
  imports: [RuleReferenceComponent, CapitalizeFirstPipe, EntryRendererComponent],
  templateUrl: './monster-stat-block.component.html',
  host: { '[class.compact]': 'compact()' },
  styleUrl: './stat-block.css',
})
export class MonsterStatBlockComponent extends MonsterPresentation {
  readonly value = input.required<Monster>();
  readonly compact = input(false);
  readonly showSummary = input(true);
  readonly senseDescriptions = input<readonly RuleDescriptionSnapshot[]>([]);

  /** Link the explicitly named sense; its source text, range and qualifiers stay untouched. */
  senseDescription(text: string): RuleDescriptionSnapshot | undefined {
    const name = STANDARD_SENSES.find(name => new RegExp(`^${name}\\b`, 'i').test(text.trim()));
    return name ? this.senseDescriptions().find(reference => reference.name.toLowerCase() === name.toLowerCase()) : undefined;
  }
}
