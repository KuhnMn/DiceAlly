import { classDefinition } from '../content/class-adapter';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterClassEntry, ExportedCharacter } from '../models/character.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord } from '../content/content.model';
import { activeContentRevision } from './active-content-revision';
import { SearchableSelectComponent, SelectOption } from './searchable-select.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { UiIconComponent } from '../ui-icon.component';
import { InfoButtonComponent } from '../info-button.component';

@Component({
  selector: 'app-editor-classes',
  imports: [FormsModule, SearchableSelectComponent, UiIconComponent, InfoButtonComponent],
  styleUrl: './editor.css',
  template: `
    <div class="mb-2 flex items-center gap-1"><h3 class="text-sm font-semibold">Classes &amp; Levels</h3><app-info-button title="Displayed classes"><p>These rows describe your character and add up to its total level. Library selections and levels prefill the Class Wizard the next time it opens. Editing these rows does not itself add proficiencies, features, or spells.</p><p>Applying the wizard replaces library-selected rows and the displayed background. Custom class text stays alongside the wizard's classes.</p></app-info-button><button type="button" class="secondary-button compact-button ml-auto" (click)="add()"><app-ui-icon name="plus" /> Class</button></div>
    <div class="space-y-2">
      @for (entry of sheet().classes ?? []; track $index; let i = $index) {
        <div class="rounded-lg border border-outline-variant bg-surface-container p-2 space-y-2">
          <div class="flex items-end gap-2">
            <label class="min-w-0 flex-1"><span class="field-label">Class</span><app-searchable-select [label]="'Class ' + (i + 1)" [compact]="true" [options]="classOptions(entry)" [value]="entry.custom ? 'CUSTOM' : entry.classKey ?? ''" (selected)="select(entry, $event)" /></label>
            <label class="w-16 shrink-0"><span class="field-label">Level</span><input class="editor-input !px-1 text-center" type="number" min="1" step="1" required [name]="'display-class-level-' + i" [ngModel]="entry.level" (ngModelChange)="level(entry, $event)" /></label>
            <button type="button" class="secondary-button compact-button icon-button shrink-0" [attr.aria-label]="'Remove class ' + (entry.name || (i + 1))" (click)="remove(i)"><app-ui-icon name="close" /></button>
          </div>
          @if (entry.custom) { <label class="block"><span class="sr-only">Custom class name</span><input class="editor-input" [name]="'display-class-name-' + i" [(ngModel)]="entry.name" (ngModelChange)="change()" placeholder="Custom class name" /></label> }
          <label class="block"><span class="field-label">Subclass (optional)</span>
            @if (entry.custom) { <input class="editor-input" [name]="'display-subclass-name-' + i" [(ngModel)]="entry.subclass" (ngModelChange)="change()" placeholder="Custom subclass name" /> }
            @else { <app-searchable-select [label]="'Subclass ' + (i + 1)" [compact]="true" [options]="subclassOptions(entry)" [value]="entry.subclassKey ?? ''" (selected)="selectSubclass(entry, $event)" /> }
          </label>
        </div>
      } @empty { <p class="text-xs text-on-surface-variant">Add a class from your library or enter custom text.</p> }
    </div>
  `,
})
export class ClassesEditorComponent implements OnInit {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  private readonly destroy = inject(DestroyRef);
  records: ContentRecord[] = [];
  async ngOnInit() {
    const cache = new IndexedDbContentCache();
    try {
      const revision = await activeContentRevision(cache);
      if (revision) {
        const records = (await cache.searchCategory(revision.id, ['class', 'subclass'], '', 0, Number.MAX_SAFE_INTEGER)).records;
        if (!this.destroy.destroyed) { this.records = records; this.view.markForCheck(); }
      }
    }
    catch { /* Custom classes remain available without imported content. */ }
  }
  classOptions(entry: CharacterClassEntry): SelectOption[] {
    const options = [{ value: 'CUSTOM', label: 'Custom class' }, ...this.records.filter(record => record.kind === 'class' && this.books.allows(record.publication))
      .map(record => ({ value: record.key, label: `${record.name} (${record.publication})` }))];
    if (entry.classKey && !options.some(option => option.value === entry.classKey)) options.push({ value: entry.classKey, label: entry.name });
    return options;
  }
  subclassOptions(entry: CharacterClassEntry): SelectOption[] {
    const options = [{ value: '', label: 'None' }, ...this.records.filter(record => record.kind === 'subclass'
      && classDefinition(record).parent?.key === entry.classKey && this.books.allows(record.publication))
      .map(record => ({ value: record.key, label: `${record.name} (${record.publication})` }))];
    if (entry.subclassKey && !options.some(option => option.value === entry.subclassKey)) options.push({ value: entry.subclassKey, label: entry.subclass ?? 'Saved subclass' });
    return options;
  }
  add() { (this.sheet().classes ??= []).push({ name: '', level: 1, custom: true }); this.change(); }
  remove(index: number) { this.sheet().classes!.splice(index, 1); this.change(); }
  level(entry: CharacterClassEntry, value: number) { entry.level = value; this.change(); }
  select(entry: CharacterClassEntry, key: string) {
    const record = this.records.find(record => record.key === key);
    entry.custom = key === 'CUSTOM'; entry.name = record?.name ?? ''; entry.classKey = record?.key;
    delete entry.subclass; delete entry.subclassKey; this.change();
  }
  selectSubclass(entry: CharacterClassEntry, key: string) { entry.subclassKey = key || undefined; entry.subclass = this.records.find(record => record.key === key)?.name; this.change(); }
  change() {
    this.view.markForCheck();
    const levels = this.sheet().classes ?? [];
    if (levels.length && levels.every(entry => Number.isSafeInteger(entry.level) && entry.level > 0)) this.sheet().character!.level = levels.reduce((total, entry) => total + entry.level, 0);
    this.edited.emit();
  }
}
