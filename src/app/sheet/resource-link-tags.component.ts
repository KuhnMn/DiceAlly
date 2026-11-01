import { Component, computed, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { ResourceCost } from '../models/source-resources';
import { UiIconComponent } from '../ui-icon.component';

/** Compact, read-only costs for collapsed feature and spell lists. */
@Component({
  selector: 'app-resource-link-tags',
  imports: [UiIconComponent],
  host: { class: 'contents' },
  template: `@for (tag of tags(); track $index) {
    <span class="inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container"
      [title]="tag.description" [attr.aria-label]="tag.description">
      <app-ui-icon class="shrink-0" name="link" />
      <span class="min-w-0 max-w-48 truncate">{{ tag.name }}</span>
      <span class="shrink-0 tabular-nums">· {{ tag.amount }}</span>
    </span>
  }`,
})
export class ResourceLinkTagsComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly links = input<ResourceCost[]>([]);
  readonly tags = computed(() => this.links().map(link => {
    const name = this.sheet().resources?.find(resource => resource.id === link.resourceId)?.name ?? 'Missing resource';
    return { name, amount: link.amount, description: `Resource: ${name} · Cost: ${link.amount}` };
  }));
}
