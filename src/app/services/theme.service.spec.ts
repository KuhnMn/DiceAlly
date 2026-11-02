import { TestBed } from '@angular/core/testing';
import { ThemePickerComponent } from '../theme-picker.component';
import { ThemeService } from './theme.service';

describe('Deepwater theme selection', () => {
  it('loads a saved palette, switches through the picker and removes old theme classes', () => {
    const html = document.documentElement;
    const previousClass = html.className, previousTheme = html.getAttribute('data-theme');
    const previousSaved = localStorage.getItem('ally-sheet-theme');
    try {
      localStorage.setItem('ally-sheet-theme', 'dark-deepwater');
      const service = TestBed.inject(ThemeService);
      const fixture = TestBed.createComponent(ThemePickerComponent);
      fixture.detectChanges(); TestBed.tick();
      const picker = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      expect(picker.value).toBe('dark-deepwater');
      expect(html.classList.contains('dark-theme')).toBe(true);
      expect(html.classList.contains('deepwater-theme')).toBe(true);
      picker.value = 'light-deepwater'; picker.dispatchEvent(new Event('change')); TestBed.tick();
      expect(service.currentTheme()).toBe('light-deepwater');
      expect(html.classList.contains('light-theme')).toBe(true);
      expect(html.classList.contains('dark-theme')).toBe(false);
      expect(localStorage.getItem('ally-sheet-theme')).toBe('light-deepwater');
      service.setTheme('dark-glade'); TestBed.tick();
      expect(html.classList.contains('glade-theme')).toBe(true);
      expect(html.classList.contains('deepwater-theme')).toBe(false);
      fixture.destroy();
    } finally {
      TestBed.resetTestingModule();
      html.className = previousClass;
      if (previousTheme === null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', previousTheme);
      if (previousSaved === null) localStorage.removeItem('ally-sheet-theme'); else localStorage.setItem('ally-sheet-theme', previousSaved);
    }
  });
});
