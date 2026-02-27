import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'ally-sheet-theme';
  private readonly DEFAULT_THEME: Theme = 'light';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  currentTheme = signal<Theme>(this.DEFAULT_THEME);

  constructor() {
    // Load saved theme preference on browser
    if (this.isBrowser) {
      const savedTheme = this.loadStoredTheme();
      this.currentTheme.set(savedTheme);
      this.applyTheme(savedTheme);

      // Watch for theme changes and apply + persist them
      effect(() => {
        const theme = this.currentTheme();
        this.applyTheme(theme);
        this.persistTheme(theme);
      });
    }
  }

  private loadStoredTheme(): Theme {
    if (!this.isBrowser) {
      return this.DEFAULT_THEME;
    }
    
    try {
      const stored = localStorage.getItem(this.THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (e) {
      console.warn('Failed to load theme from storage:', e);
    }
    
    return this.DEFAULT_THEME;
  }

  private persistTheme(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }
    
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (e) {
      console.warn('Failed to persist theme to storage:', e);
    }
  }

  private applyTheme(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }
    
    const html = document.documentElement;
    
    // Remove both theme classes
    html.classList.remove('light-theme', 'dark-theme');
    
    // Add the appropriate theme class
    if (theme === 'dark') {
      html.classList.add('dark-theme');
    } else {
      html.classList.add('light-theme');
    }
  }

  toggleTheme(): void {
    this.currentTheme.update(current => current === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }
}
