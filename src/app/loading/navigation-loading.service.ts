import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { isModuleLoadError } from './lazy-load';

@Injectable({ providedIn: 'root' })
export class NavigationLoadingService {
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly failure = signal<{ url: string; module: boolean } | null>(null);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) { this.failure.set(null); this.loading.set(true); }
      else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationSkipped || event instanceof NavigationError) {
        this.loading.set(false);
      }
    });
  }
  failed(event: NavigationError) {
    this.failure.set({ url: event.url, module: isModuleLoadError(event.error) });
  }
  async retry() {
    const failure = this.failure();
    if (failure && !this.loading()) await this.router.navigateByUrl(failure.url);
  }
  dismiss() { this.failure.set(null); }
}
