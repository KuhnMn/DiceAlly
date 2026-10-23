import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UiIconComponent } from './ui-icon.component';

/** Stable navigation between play, reference lookup and library management. */
@Component({
  selector: 'app-library-navigation',
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  template: `
    <nav aria-label="Library navigation" class="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1 text-xs sm:text-sm">
      @for (link of links; track link.path) {
        <a [routerLink]="link.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: link.path === '/'}" ariaCurrentWhenActive="page"
          class="flex min-h-12 min-w-0 flex-wrap items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon [name]="link.icon" /><span>{{ link.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: ['.active { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }'],
})
export class LibraryNavigationComponent {
  readonly links = [
    { path: '/', label: 'Characters', icon: 'head' },
    { path: '/compendium', label: 'Compendium', icon: 'book' },
    { path: '/content', label: 'Game Data', icon: 'stack' },
  ];
}
