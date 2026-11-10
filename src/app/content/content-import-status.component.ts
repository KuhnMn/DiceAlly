import { Component, inject } from '@angular/core';
import { ContentImportService } from './content-import.service';

@Component({
  selector: 'app-content-import-status',
  templateUrl: './content-import-status.component.html',
  styleUrls: ['../editor/editor.css', './content-import-status.component.css'],
})
export class ContentImportStatusComponent {
  readonly state = inject(ContentImportService);
}
