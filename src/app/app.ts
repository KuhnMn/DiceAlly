import { AppDialogComponent } from './app-dialog.component';
import { AppDialogService } from './services/app-dialog.service';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgOptimizedImage, AppDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  readonly dialogs = inject(AppDialogService);
  // Initialize theme service to load/apply theme on startup
  private themeService = inject(ThemeService);
  
  protected readonly title = signal('AllySheetViewer');
}
