import { Component, computed, input } from '@angular/core';
import { Proficiencies } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

// Older exports put these language names in the untyped custom list.
const LEGACY_LANGUAGES = new Set([
  'common', 'common sign language', 'dwarvish', 'elvish', 'giant', 'gnomish',
  'goblin', 'halfling', 'orc', 'abyssal', 'celestial', 'deep speech', 'draconic',
  'infernal', 'primordial', 'sylvan', 'undercommon', 'aquan', 'auran', 'ignan',
  'terran', 'druidic', 'thieves cant', 'yuan ti', 'yuan-ti',
]);

function key(label: string): string {
  return label.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\s*\([A-Z][A-Z0-9-]*\)\s*$/, '').replace(/['’]/g, '').trim().toLowerCase();
}

function identity(label: string): string {
  return key(label).replace(/^(light|medium|heavy|shields?)(?: armor| armour)?$/, (_, armor: string) => armor === 'shields' ? 'shield' : armor);
}

/** Group legacy custom entries for display without altering the saved proficiencies. */
export function proficiencyGroups(proficiencies?: Proficiencies) {
  const groups = new Map(['Weapons', 'Armor', 'Tools', 'Languages', 'Other'].map(name => [name, [] as string[]]));
  const seen = new Set<string>();
  const add = (group: string, label: string) => {
    const normalized = identity(label);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    groups.get(group)!.push(label);
  };
  if (proficiencies?.simpleWeapons) add('Weapons', 'Simple Weapons');
  if (proficiencies?.martialWeapons) add('Weapons', 'Martial Weapons');
  for (const tool of Object.keys(proficiencies?.tools ?? {})) add('Tools', tool);
  for (const language of proficiencies?.languages ?? []) add('Languages', language);
  for (const custom of proficiencies?.custom ?? []) {
    const normalized = key(custom);
    const group = LEGACY_LANGUAGES.has(normalized) ? 'Languages'
      : /^(light|medium|heavy)( armor| armour)?$|^shields?( armor| armour)?$/.test(normalized) ? 'Armor'
      : /\bweapons?\b/.test(normalized) ? 'Weapons'
      : /\b(tools?|supplies|kits?|instruments?|vehicles?)\b/.test(normalized) ? 'Tools' : 'Other';
    add(group, custom);
  }
  return [...groups].filter(([, entries]) => entries.length).map(([name, entries]) => ({ name, entries }));
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
            @for (entry of group.entries; track entry) {
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
