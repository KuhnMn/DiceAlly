import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ExportedCharacter } from '../models/character.model';

interface Note {
  id: number;
  characterId?: number;
  title: string;
  body: string;
  orderIndex?: number;
}

@Component({
  selector: 'app-notes-page',
  imports: [CommonModule],
  template: `
    <div class="bg-white p-8 rounded-lg border-2 border-gray-300 shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Notes</h2>
      
      @if (groupedNotes().size > 0) {
        <div class="space-y-6">
          @for (section of sortedSections(); track section) {
            <div class="border-2 border-gray-300 rounded-lg p-6 bg-gray-50">
              <!-- Section Header (clickable) -->
              <button
                type="button"
                class="w-full text-left hover:bg-gray-100 transition-colors rounded p-2 -m-2 mb-3"
                (click)="toggleExpanded('section-' + section)"
              >
                <div class="flex justify-between items-center">
                  <h3 class="text-2xl font-bold text-gray-900">{{ section }}</h3>
                  <span class="text-2xl text-gray-600 font-bold">{{ isExpanded('section-' + section) ? '−' : '+' }}</span>
                </div>
              </button>
              
              <!-- Notes Content (expandable) -->
              @if (isExpanded('section-' + section)) {
                <div class="space-y-3 pt-3 border-t border-gray-300">
                  @for (note of groupedNotes().get(section); track note.id) {
                    <div class="p-4 bg-white rounded border-l-4 border-blue-400 hover:shadow-md transition-shadow">
                      <div class="text-sm leading-relaxed prose prose-sm max-w-none text-gray-700" [innerHTML]="parseMarkdown(note.body)"></div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-10 px-5 text-gray-400 text-base">
          <p>No notes yet.</p>
        </div>
      }
    </div>
  `,
})
export class NotesPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  expandedItems = signal<Set<string>>(new Set());

  notes = computed(() => {
    const data = this.characterData();
    if (!data?.notes) return [];
    // Sort within each section by orderIndex, but maintain section grouping order
    return [...data.notes];
  });

  groupedNotes = computed(() => {
    const grouped = new Map<string, Note[]>();
    for (const note of this.notes()) {
      const title = note.title || 'Untitled';
      if (!grouped.has(title)) {
        grouped.set(title, []);
      }
      grouped.get(title)!.push(note);
    }
    
    // Sort notes within each section by orderIndex
    for (const section of grouped.keys()) {
      grouped.get(section)!.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }
    
    return grouped;
  });

  sortedSections = computed(() => {
    const sections = Array.from(this.groupedNotes().keys());
    // Sort sections by the lowest orderIndex in each section
    return sections.sort((a, b) => {
      const aIndex = this.groupedNotes().get(a)?.[0]?.orderIndex ?? 0;
      const bIndex = this.groupedNotes().get(b)?.[0]?.orderIndex ?? 0;
      return aIndex - bIndex;
    });
  });

  constructor(private sanitizer: DomSanitizer) {}
toggleExpanded(id: string) {
    const expanded = this.expandedItems();
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    this.expandedItems.set(new Set(expanded));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  
  parseMarkdown(markdown: string): SafeHtml {
    // Simple markdown parsing to HTML
    let html = markdown
      // Escape HTML entities first to prevent XSS
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Parse markdown
      .replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/\n\n+/g, '</p><p class="my-3">')
      .replace(/\n/g, '<br />');
    
    html = `<p class="my-2">${html}</p>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
