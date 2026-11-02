import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { Theme, ThemeService } from './services/theme.service';
import { UiIconComponent } from './ui-icon.component';

/** Shared, keyboard-accessible theme chooser for the library, editor and viewer. */
@Component({
  selector: 'app-theme-picker',
  host: { class: 'block min-w-0' },
  imports: [UiIconComponent],
  template: `
    <details #menu class="relative">
      <summary aria-label="Color theme" title="Color Theme"
        class="flex min-h-10 w-full min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-2 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <app-ui-icon [name]="themeIcon(themes.currentTheme())" class="shrink-0 text-primary" />
        <span class="min-w-0 flex-1 truncate">{{ label(themes.currentTheme()) }}</span>
        <app-ui-icon name="chevron-down" class="shrink-0" />
      </summary>
      <div aria-label="Color themes" class="absolute right-0 top-full z-50 mt-1 max-h-[min(24rem,60dvh)] w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-high p-1 shadow-xl">
        @for (theme of themes.availableThemes; track theme) {
          <button type="button" [attr.data-theme]="theme" [attr.aria-pressed]="theme === themes.currentTheme()" (click)="select(theme)"
            [class.bg-primary-container]="theme === themes.currentTheme()" [class.text-on-primary-container]="theme === themes.currentTheme()"
            class="flex min-h-10 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary">
            <app-ui-icon [name]="themeIcon(theme)" class="shrink-0" />
            <span class="min-w-0 flex-1">{{ label(theme) }}</span>
            <app-ui-icon [name]="theme.startsWith('light') ? 'sun' : 'moon'" class="shrink-0 text-on-surface-variant" />
          </button>
        }
      </div>
    </details>
  `,
})
export class ThemePickerComponent {
  readonly themes = inject(ThemeService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;
  private readonly icons: Record<string, string> = {
    mc: 'sparkles', royal: 'crown', ethereal: 'wand', forge: 'flame', glade: 'leaf', deepwater: 'waves',
  };
  themeIcon(theme: Theme): string { return this.icons[theme.split('-')[1]] ?? 'sparkles'; }
  label(theme: Theme): string {
    const [mode, name] = theme.split('-');
    const title = name === 'mc' ? 'Monte Carlo' : name.charAt(0).toUpperCase() + name.slice(1);
    return `${mode === 'light' ? 'Light' : 'Dark'} · ${title}`;
  }
  select(theme: Theme) {
    this.themes.setTheme(theme);
    if (this.menu) {
      this.menu.nativeElement.open = false;
      this.menu.nativeElement.querySelector('summary')?.focus();
    }
  }
  @HostListener('document:pointerdown', ['$event']) dismissOutside(event: Event) {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target) && this.menu) this.menu.nativeElement.open = false;
  }
  @HostListener('document:keydown.escape') close() {
    if (this.menu?.nativeElement.open) {
      this.menu.nativeElement.open = false;
      this.menu.nativeElement.querySelector('summary')?.focus();
    }
  }
}
