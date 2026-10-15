import { Component, input } from '@angular/core';
import { Monster } from '../models/character.model';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { MonsterPresentation } from './monster-presentation';

@Component({
  selector: 'app-monster-stat-block',
  imports: [CapitalizeFirstPipe, EntryRendererComponent],
  templateUrl: './monster-stat-block.component.html',
  host: { '[class.compact]': 'compact()' },
  styles: [`
    :host { display: block; min-width: 0; overflow-wrap: anywhere; }
    :host(.compact) .text-xl, :host(.compact) .text-2xl, :host(.compact) .text-lg { font-size: .875rem; line-height: 1.4; }
    :host(.compact) .mt-6 { margin-top: .75rem; }
    :host(.compact) .my-3, :host(.compact) .my-4 { margin-top: .5rem; margin-bottom: .5rem; }
    :host(.compact) .p-3 { padding: .5rem; }
    :host(.compact) .px-4 { padding-left: .75rem; padding-right: .75rem; }
    :host(.compact) .py-3 { padding-top: .5rem; padding-bottom: .5rem; }
    :host(.compact) .mb-3 { margin-bottom: .5rem; }
    :host(.compact) .pt-4 { padding-top: .75rem; }
  `],
})
export class MonsterStatBlockComponent extends MonsterPresentation {
  readonly value = input.required<Monster>();
  readonly compact = input(false);
  readonly showSummary = input(true);
}
