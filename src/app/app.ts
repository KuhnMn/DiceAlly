import { ChangeDetectionStrategy, Component, inject, signal, isDevMode } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly development = isDevMode();
  // Initialize theme service to load/apply theme on startup
  private themeService = inject(ThemeService);
  
  protected readonly title = signal('AllySheetViewer');
}
