import { Component, computed, input, signal } from '@angular/core';
import { ContentRecord } from '../content/content.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { classCastingNotes, classGrantedSpells, classResourceTables, groupGrantedSpells, resourceCell, ResourceTable } from './class-resources';

@Component({
  selector: 'app-class-resources',
  imports: [EntryRendererComponent],
  templateUrl: './class-resources.component.html',
  styles: [`
    :host { display: block; min-width: 0; margin-bottom: 1.5rem; }
    th, td { border-bottom: 1px solid var(--md-sys-color-outline-variant); padding: .5rem .65rem; text-align: center; vertical-align: middle; }
    th { font-weight: 600; background: var(--md-sys-color-surface-container-high); }
    .level-cell { position: sticky; left: 0; z-index: 1; min-width: 3.5rem; background: var(--md-sys-color-surface-container); }
    thead .level-cell { z-index: 2; background: var(--md-sys-color-surface-container-high); }
    .resource-group { border-left: 1px solid var(--md-sys-color-outline-variant); }
    tr.preview-level td, tr.preview-level th { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
    .table-scroll:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
    .slot-values { display: grid; grid-template-columns: repeat(var(--slot-columns), minmax(0, 1fr)); gap: .35rem .5rem; }
    @media (min-width: 640px) { .slot-values { grid-template-columns: repeat(var(--slot-wide-columns), minmax(0, 1fr)); } }
  `],
})
export class ClassResourcesComponent {
  readonly owner = input.required<ContentRecord>();
  readonly subclass = input<ContentRecord | null>(null);
  readonly selectedLevel = signal(1);
  readonly tables = computed(() => classResourceTables(this.owner(), this.subclass()));
  readonly tableLevels = computed(() => Array.from({ length: Math.max(0, ...this.tables().map(table => table.rows.length)) }, (_, index) => index + 1));
  readonly notes = computed(() => classCastingNotes(this.owner(), this.subclass()));
  readonly noteGroups = computed(() => {
    const groups = new Map<string, ReturnType<typeof classCastingNotes>>();
    for (const note of this.notes()) { if (!groups.has(note.owner)) groups.set(note.owner, []); groups.get(note.owner)!.push(note); }
    return [...groups].map(([owner, notes]) => ({ owner, notes }));
  });
  readonly grants = computed(() => classGrantedSpells(this.owner(), this.subclass()));
  readonly grantLists = computed(() => groupGrantedSpells(this.grants()));
  readonly levels = computed(() => Array.from({ length: Math.max(20, ...this.tables().map(table => table.rows.length)) }, (_, index) => index + 1));
  cell(table: ResourceTable, level: number, column: number) { return resourceCell(table.rows[level]?.[column]); }
  slotColumns(table: ResourceTable, wide = false) { return Math.max(1, Math.min(wide ? 9 : 5, table.labels.length)); }
  levelChanged(value: string) { const level = Number(value); if (this.levels().includes(level)) this.selectedLevel.set(level); }
}
