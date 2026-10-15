import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { THEMES } from '../settings/account-settings';

export type Theme = 'light-mc' | 'dark-mc' | 'light-royal' | 'dark-royal' | 'light-ethereal' | 'dark-ethereal' | 'light-forge' | 'dark-forge' | 'light-glade' | 'dark-glade';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'ally-sheet-theme';
  private readonly DEFAULT_THEME: Theme = 'light-mc';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  currentTheme = signal<Theme>(this.DEFAULT_THEME);
  
  // List of available themes
    readonly availableThemes: readonly Theme[] = THEMES;

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
      if (this.availableThemes.includes(stored as Theme)) {
        return stored as Theme;
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
    
    // Remove all theme classes
      html.classList.remove('light-theme', 'dark-theme', 'royal-theme', 'ethereal-theme', 'forge-theme', 'glade-theme');
    
    // Set data attribute for theme
    html.setAttribute('data-theme', theme);
    
    // Add appropriate theme classes for styling
    if (theme.startsWith('dark')) {
      html.classList.add('dark-theme');
    } else {
      html.classList.add('light-theme');
    }
    
    if (theme.includes('royal')) {
      html.classList.add('royal-theme');
      }
    
      if (theme.includes('ethereal')) {
        html.classList.add('ethereal-theme');
    }

    if (theme.includes('forge')) {
      html.classList.add('forge-theme');
    }

    if (theme.includes('glade')) {
      html.classList.add('glade-theme');
    }
  }

  toggleTheme(): void {
    this.currentTheme.update(current => {
      const themeIndex = this.availableThemes.indexOf(current);
      const nextIndex = (themeIndex + 1) % this.availableThemes.length;
      return this.availableThemes[nextIndex];
    });
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }
}
