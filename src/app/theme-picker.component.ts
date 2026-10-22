import { Component, inject } from '@angular/core';
import { Theme, ThemeService } from './services/theme.service';

/** Shared theme control; the service persists the selection across creator and viewer. */
@Component({
  selector: 'app-theme-picker',
  host: { class: 'block' },
  template: `
    <select aria-label="Color theme" title="Color Theme" (change)="select($event)"
      class="w-full min-w-0 min-h-10 rounded-lg bg-surface-container text-on-surface px-2 py-2 text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-primary">
      @for (theme of themes.availableThemes; track theme) { <option [value]="theme" [selected]="theme === themes.currentTheme()">{{ label(theme) }}</option> }
    </select>
  `,
})
export class ThemePickerComponent {
  readonly themes = inject(ThemeService);
  private readonly symbols: Record<Theme, string> = {
    'light-mc': '☀️', 'dark-mc': '🌙',
    'light-royal': '✨', 'dark-royal': '👑',
    'light-ethereal': '🌌', 'dark-ethereal': '💜',
    'light-forge': '🔥', 'dark-forge': '⚒️',
    'light-glade': '🌿', 'dark-glade': '🍃',
  };
  label(theme: Theme): string {
    const [mode, name] = theme.split('-');
    const title = name === 'mc' ? 'Monte Carlo' : name.charAt(0).toUpperCase() + name.slice(1);
    return `${this.symbols[theme]} ${mode === 'light' ? 'Light' : 'Dark'} · ${title}`;
  }
  select(event: Event) { this.themes.setTheme((event.target as HTMLSelectElement).value as Theme); }
}
