import { Component, input, output } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { OPTIONAL_SHEET_PAGES, OptionalSheetPage, isSheetPageVisible } from '../models/sheet-pages';

@Component({
  selector: 'app-editor-sheet-settings',
  host: { class: 'block min-w-0' },
  styleUrl: './editor.css',
  template: `
    <section class="editor-card" aria-labelledby="sheet-settings-title">
      <h2 id="sheet-settings-title">Sheet Pages</h2>
      <p class="mb-4 text-sm text-on-surface-variant">Choose which pages appear in this character's sheet. Hidden pages keep their content and remain editable here. Sheet and Features are always visible.</p>
      <div class="space-y-2">
        @for (page of pages; track page.key) {
          <label class="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2">
            <span class="text-sm font-semibold">{{ page.label }}</span>
            <input type="checkbox" class="h-5 w-5 shrink-0 accent-primary" [checked]="visible(page.id)" (change)="setVisible(page.key, $any($event.target).checked)" />
          </label>
        }
      </div>
    </section>
  `,
})
export class SheetSettingsEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly pages = OPTIONAL_SHEET_PAGES;
  visible(id: number) { return isSheetPageVisible(this.sheet(), id); }
  setVisible(page: OptionalSheetPage, visible: boolean) {
    const sheet = this.sheet();
    sheet.sheetSettings = { ...sheet.sheetSettings, visiblePages: { ...sheet.sheetSettings?.visiblePages, [page]: visible } };
    this.edited.emit();
  }
}
