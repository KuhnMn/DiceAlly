import { Component, input } from '@angular/core';
import { FormsModule, ControlContainer, NgForm } from '@angular/forms';
import { UiIconComponent } from '../ui-icon.component';
import { BasicInfoEditorModel } from './basic-info-editor-model';
import { InfoButtonComponent } from '../info-button.component';
import { BackgroundEditorComponent } from './background-editor.component';
import { ClassesEditorComponent } from './classes-editor.component';

@Component({
  selector: 'app-editor-basic-info',
  imports: [FormsModule, UiIconComponent, InfoButtonComponent, BackgroundEditorComponent, ClassesEditorComponent],
  templateUrl: './basic-info-editor.component.html',
  styleUrls: ['./editor.css', './editor-steppers.css'],
  host: { class: 'block min-w-0 space-y-4' },
  // Keep the controls in the shell's form, including validation and submit behavior.
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class BasicInfoEditorComponent {
  readonly model = input.required<BasicInfoEditorModel>();
}
