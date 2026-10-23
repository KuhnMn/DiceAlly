import { Component, input } from '@angular/core';
import { FormsModule, ControlContainer, NgForm } from '@angular/forms';
import { UiIconComponent } from '../ui-icon.component';
import { AbilityScoresEditorModel } from './ability-scores-editor-model';

@Component({
  selector: 'app-editor-ability-scores',
  imports: [FormsModule, UiIconComponent],
  templateUrl: './ability-scores-editor.component.html',
  styleUrls: ['./editor.css', './editor-steppers.css'],
  host: { class: 'block min-w-0 space-y-4' },
  // Keep the controls in the shell's form, including validation and submit behavior.
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class AbilityScoresEditorComponent {
  readonly model = input.required<AbilityScoresEditorModel>();
}
