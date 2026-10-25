import { Component, computed, input } from '@angular/core';
import { ContentRecord } from '../content/content.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { classProficiencies } from './class-proficiencies';

@Component({
  selector: 'app-class-proficiencies',
  imports: [EntryRendererComponent],
  host: { class: 'block min-w-0' },
  template: `
    @if (info().requirements.length || info().proficiencies.length || info().entries.length) {
      <section class="mb-4 min-w-0" [attr.aria-label]="multiclass() ? 'Multiclassing' : 'Class Basics'">
        <h2 class="mb-2 text-base font-semibold sm:text-lg">{{ multiclass() ? 'Multiclassing' : 'Class Basics' }}</h2>
        <div class="rounded-lg border border-outline-variant bg-surface-container px-2.5 py-1">
          <dl class="divide-y divide-outline-variant">
            @for (row of info().requirements; track row.label) {
              <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 py-1.5 text-xs leading-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:text-sm">
                <dt class="text-on-surface-variant">{{ row.label }}</dt><dd class="min-w-0 [overflow-wrap:anywhere]"><app-entry-renderer [entries]="row.entries" [compact]="true" /></dd>
              </div>
            }
          </dl>
          @if (multiclass() && info().proficiencies.length) { <h3 class="pt-2 text-xs font-semibold text-on-surface-variant">Proficiencies Gained</h3> }
          <dl class="divide-y divide-outline-variant">
            @for (row of info().proficiencies; track row.label) {
              <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 py-1.5 text-xs leading-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:text-sm">
                <dt class="text-on-surface-variant">{{ row.label }}</dt><dd class="min-w-0 [overflow-wrap:anywhere]"><app-entry-renderer [entries]="row.entries" [compact]="true" /></dd>
              </div>
            }
          </dl>
          @if (info().entries.length) { <div class="py-1.5 text-xs leading-5 sm:text-sm"><app-entry-renderer [entries]="info().entries" [compact]="true" /></div> }
        </div>
      </section>
    }
  `,
})
export class ClassProficienciesComponent {
  readonly owner = input.required<ContentRecord>();
  readonly multiclass = input(false);
  readonly info = computed(() => classProficiencies(this.owner(), this.multiclass()));
}
