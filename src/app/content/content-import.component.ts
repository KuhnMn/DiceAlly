import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../ui-icon.component';
import { LibraryNavigationComponent } from '../library-navigation.component';
import { ContentImportService } from './content-import.service';
import { ContentImportStatusComponent } from './content-import-status.component';

@Component({
  selector: 'app-content-import',
  imports: [LibraryNavigationComponent, UiIconComponent, FormsModule, RouterLink, ContentImportStatusComponent],
  styleUrls: ['../editor/editor.css', './content-import.component.css'],
  templateUrl: './content-import.component.html',
})
export class ContentImportComponent implements OnInit, OnDestroy {
  private readonly imports = inject(ContentImportService);

  readonly busy = this.imports.busy;
  readonly importing = this.imports.importing;
  readonly message = this.imports.message;
  readonly updateMessage = this.imports.updateMessage;
  readonly checkingRules = this.imports.checkingRules;
  readonly checkingHomebrewFiles = this.imports.checkingHomebrewFiles;
  readonly homebrewMessages = this.imports.homebrewMessages;
  readonly progress = this.imports.progress;
  readonly revision = this.imports.revision;
  readonly diagnostics = this.imports.diagnostics;
  readonly hasImportErrors = this.imports.hasImportErrors;
  readonly visibleDiagnostics = this.imports.visibleDiagnostics;
  readonly cachedRevisions = this.imports.cachedRevisions;
  readonly storage = this.imports.storage;
  readonly removal = this.imports.removal;
  get source() { return this.imports.source; }
  set source(value: ContentImportService['source']) { this.imports.source = value; }
  get homebrewUrl() { return this.imports.homebrewUrl; }
  set homebrewUrl(value: string) { this.imports.homebrewUrl = value; }
  get homebrewFile() { return this.imports.homebrewFile; }
  set homebrewFile(value: File | undefined) { this.imports.homebrewFile = value; }

  readonly check = this.imports.check.bind(this.imports);
  readonly start = this.imports.start.bind(this.imports);
  readonly chooseHomebrew = this.imports.chooseHomebrew.bind(this.imports);
  readonly removeHomebrew = this.imports.removeHomebrew.bind(this.imports);
  readonly checkHomebrew = this.imports.checkHomebrew.bind(this.imports);
  readonly refreshHomebrew = this.imports.refreshHomebrew.bind(this.imports);
  readonly startHomebrew = this.imports.startHomebrew.bind(this.imports);
  readonly refreshStorage = this.imports.refreshStorage.bind(this.imports);
  readonly removeRevision = this.imports.removeRevision.bind(this.imports);
  readonly mb = this.imports.mb.bind(this.imports);

  ngOnInit(): Promise<void> { return this.imports.initialize(); }
  ngOnDestroy(): void { this.imports.cancelUpdateChecks(); }
}
