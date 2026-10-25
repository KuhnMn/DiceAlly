import { Component, computed, effect, input, signal } from '@angular/core';
import { bastionPlanUrl } from '../models/bastion';

@Component({
  selector: 'app-bastion-plan',
  host: { class: 'block min-w-0' },
  template: `
    @if (url(); as imageUrl) {
      <section aria-label="Bastion plan" class="mb-4 min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container">
        <header class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <h3 class="font-semibold">Bastion Plan</h3>
          <a [href]="imageUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-primary underline">Open Image</a>
        </header>
        @if (failed()) {
          <p role="status" class="px-3 pb-3 text-sm text-on-surface-variant">The plan image could not be loaded. Check the URL or try opening the image directly.</p>
        } @else {
          <img [src]="imageUrl" alt="Bastion plan" loading="lazy" referrerpolicy="no-referrer" (error)="failed.set(true)"
            class="mx-auto max-h-[60dvh] w-full object-contain" />
        }
      </section>
    } @else if (value()?.trim()) {
      <p role="status" class="mb-3 text-sm text-on-surface-variant">Use an http:// or https:// URL for the bastion plan.</p>
    }
  `,
})
export class BastionPlanComponent {
  readonly value = input<string>();
  readonly url = computed(() => bastionPlanUrl(this.value()));
  readonly failed = signal(false);
  constructor() { effect(() => { this.url(); this.failed.set(false); }); }
}
