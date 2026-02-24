import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterStore } from '../stores/character.store';
import type { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="max-w-[900px] mx-auto my-8 p-4">
      <h2 class="text-3xl font-bold mb-4">Import Character JSON</h2>
      <p class="text-gray-600 mb-6">Choose an exported character JSON file to view it in the browser.</p>

      <label class="block mb-6">
        <span class="block text-sm font-medium mb-2">Upload File</span>
        <input 
          type="file" 
          accept="application/json" 
          (change)="onFile($event)"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
        />
      </label>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Or paste JSON below:</label>
        <textarea 
          rows="10" 
          [(ngModel)]="raw" 
          class="w-full font-mono text-sm p-3 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          placeholder="Paste your character JSON here..."
        ></textarea>
      </div>
      
      <div class="mt-4">
        <button 
          (click)="loadFromText()"
          class="px-6 py-2 bg-sky-600 text-white font-semibold rounded hover:bg-sky-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          [disabled]="!raw.trim()"
        >
          Load from paste
        </button>
      </div>
    </main>
  `,
})
export class ImportComponent {
  private store = inject(CharacterStore);
  private router = inject(Router);

  raw = '';

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ExportedCharacter;
        this.setAndNavigate(parsed);
      } catch (e) {
        console.error('Failed to parse JSON', e);
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  loadFromText() {
    try {
      const parsed = JSON.parse(this.raw) as ExportedCharacter;
      this.setAndNavigate(parsed);
    } catch (e) {
      console.error(e);
      alert('Invalid JSON');
    }
  }

  private setAndNavigate(parsed: ExportedCharacter) {
    // Normalize the structure: ensure character exists
    if (!parsed.character && (parsed as any).name) {
      // If the root object looks like CharacterData, wrap it
      parsed = { character: parsed as any };
    }
    
    this.store.setCharacter(parsed);
    this.router.navigate(['/sheet']);
  }
}
