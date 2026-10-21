import { Component, input } from '@angular/core';
import { CharacterSpeed, effectiveSpeedFeet } from '../models/character-speed';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-sheet-speed-description',
  imports: [EntryRendererComponent, UiIconComponent],
  host: { class: 'block min-w-0' },
  template: `
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
      <span class="font-semibold text-on-surface">{{ label() }}</span>
      @if (canHover()) { <span class="rounded-full bg-teal/15 px-2 text-[10px] font-semibold leading-5 text-teal">Hover</span> }
      <span class="ml-auto inline-flex items-center gap-2 whitespace-nowrap">
        <span class="font-semibold tabular-nums">{{ feet() }} ft.</span>
        @if (speed().value.kind === 'walkingSpeed' && speed().overrideFeet == null) {
          <span class="inline-flex items-center gap-1 rounded bg-surface-container-highest px-1.5 text-xs leading-5 text-on-surface-variant" role="img" aria-label="Equal to walking speed" title="Equal to walking speed"><span>=</span><app-ui-icon name="walk" /></span>
        }
      </span>
    </div>
    @if (speed().condition) {
      <div class="mt-1.5 border-l-2 border-teal/40 pl-2 text-xs leading-relaxed text-on-surface-variant">
        <app-entry-renderer [entry]="{text: speed().condition!}" [compact]="true" [inline]="true" />
      </div>
    }
  `,
})
export class SheetSpeedDescriptionComponent {
  readonly speed = input.required<CharacterSpeed>();
  readonly speeds = input.required<readonly CharacterSpeed[]>();
  label() { const type = this.speed().type; return type.charAt(0).toUpperCase() + type.slice(1); }
  feet() { return effectiveSpeedFeet(this.speed(), this.speeds()); }
  canHover() { const speed = this.speed(); return speed.type === 'fly' && speed.canHover; }
}
