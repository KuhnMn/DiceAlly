import { Component, input } from '@angular/core';
import { FormsModule, ControlContainer, NgForm } from '@angular/forms';
import { UiIconComponent } from '../ui-icon.component';
import { BasicInfoEditorModel } from './basic-info-editor-model';

@Component({
  selector: 'app-editor-basic-info',
  imports: [FormsModule, UiIconComponent],
  templateUrl: './basic-info-editor.component.html',
  styleUrl: './editor.css',
  host: { class: 'block min-w-0 space-y-4' },
  // Keep the controls in the shell's form, including validation and submit behavior.
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class BasicInfoEditorComponent {
  readonly model = input.required<BasicInfoEditorModel>();
}
