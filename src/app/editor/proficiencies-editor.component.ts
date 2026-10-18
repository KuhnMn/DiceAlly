import { Component, input } from '@angular/core';
import { FormsModule, ControlContainer, NgForm } from '@angular/forms';
import { UiIconComponent } from '../ui-icon.component';
import { ProficienciesEditorModel } from './proficiencies-editor-model';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { MasonryCardsDirective } from './masonry-cards.directive';

@Component({
  selector: 'app-editor-proficiencies',
  imports: [FormsModule, UiIconComponent, OtherProficienciesComponent, MasonryCardsDirective],
  templateUrl: './proficiencies-editor.component.html',
  styleUrl: './editor.css',
  host: { class: 'block min-w-0 space-y-4' },
  // Keep the controls in the shell's form, including validation and submit behavior.
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class ProficienciesEditorComponent {
  readonly model = input.required<ProficienciesEditorModel>();
}
