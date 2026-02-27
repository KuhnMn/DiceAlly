import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Initialize theme service to load/apply theme on startup
  private themeService = inject(ThemeService);
  
  protected readonly title = signal('AllySheetViewer');
}
