import { Component, computed, input } from '@angular/core';
import { Proficiencies } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Display each proficiency in its stored category. */
export function proficiencyGroups(proficiencies?: Proficiencies) {
  const weapons: string[] = [];
  if (proficiencies?.simpleWeapons) weapons.push('Simple Weapons');
  if (proficiencies?.martialWeapons) weapons.push('Martial Weapons');
  return [
    { name: 'Weapons', entries: weapons },
    { name: 'Tools', entries: Object.keys(proficiencies?.tools ?? {}) },
    { name: 'Languages', entries: proficiencies?.languages ?? [] },
    { name: 'Other', entries: proficiencies?.custom ?? [] },
  ].filter(group => group.entries.length);
}

@Component({
  selector: 'app-sheet-proficiencies',
  imports: [EntryRendererComponent],
  host: { class: 'block min-w-0' },
  template: `
    <div class="space-y-3">
      @for (group of groups(); track group.name) {
        <section [attr.aria-label]="group.name">
          <h4 class="mb-1.5 text-xs font-semibold text-on-surface-variant">{{ group.name }}</h4>
          <div class="flex flex-wrap gap-1.5">
            @for (entry of group.entries; track $index) {
              <div class="min-w-0 max-w-full rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-sm [overflow-wrap:anywhere]">
                <app-entry-renderer [entry]="{text: entry}" [compact]="true" />
              </div>
            }
          </div>
        </section>
      } @empty { <p class="text-sm text-on-surface-variant">None listed.</p> }
    </div>
  `,
})
export class SheetProficienciesComponent {
  readonly proficiencies = input<Proficiencies | undefined>();
  readonly groups = computed(() => proficiencyGroups(this.proficiencies()));
}
