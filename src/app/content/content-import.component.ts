import { UiIconComponent } from '../ui-icon.component';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache, RevisionRemovalProgress } from './content-cache';
import { DEFAULT_CONTENT_SOURCE, ImportDiagnostic, ImportProgress, ImportRevision, validateSource } from './content.model';
import { ContentImportRequest } from './content-import-request';
import { resolveCommit } from './github-source';
import { LibraryNavigationComponent } from '../library-navigation.component';
import { requiresContentReimport } from './content-compatibility';

@Component({
  selector: 'app-content-import', imports: [LibraryNavigationComponent, UiIconComponent, FormsModule, RouterLink],
  styleUrls: ['../editor/editor.css', './content-import.component.css'],
  templateUrl: './content-import.component.html',
})
export class ContentImportComponent implements OnInit, OnDestroy {
  source = { ...DEFAULT_CONTENT_SOURCE };
  homebrewUrl = '';
  homebrewFile?: File;
  readonly busy = signal(false);
  readonly importing = signal(false);
  phaseLabel(phase: ImportProgress['phase']): string {
    return { resolve: 'Resolving Revision', discover: 'Finding Files', download: 'Downloading Files',
      link: 'Resolving References', materialize: 'Building Content', complete: 'Complete' }[phase];
  }
  readonly message = signal('');
  readonly updateMessage = signal('');
  readonly checkingRules = signal(false);
  readonly checkingHomebrewFiles = signal<ReadonlySet<string>>(new Set());
  readonly homebrewMessages = signal<Record<string, string>>({});
  readonly progress = signal<ImportProgress | null>(null);
  readonly revision = signal<ImportRevision | undefined>(undefined);
  readonly diagnostics = signal<ImportDiagnostic[]>([]);
  readonly hasImportErrors = computed(() => this.diagnostics().some(issue => issue.severity === 'error'));
  readonly visibleDiagnostics = computed(() => [...this.diagnostics()]
    .sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error')).slice(0, 100));
  readonly cachedRevisions = signal<Awaited<ReturnType<IndexedDbContentCache['revisions']>>>([]);
  readonly storage = signal<StorageEstimate | undefined>(undefined);
  readonly removal = signal<(RevisionRemovalProgress & { revisionId: string }) | null>(null);
  private readonly cache = new IndexedDbContentCache();
  private worker?: Worker;
  private rulesCheck?: AbortController;
  private readonly homebrewChecks = new Map<string, Worker>();
  private readonly namespace = 'development-local';

  async ngOnInit(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    this.busy.set(true);
    try {
      this.source = await this.cache.savedSource(this.namespace) ?? { ...DEFAULT_CONTENT_SOURCE };
      try {
        const removed = await this.cache.recover(this.namespace);
        if (removed) this.message.set(`Removed ${removed} interrupted import(s). Installed content retained.`);
      } catch (error) { this.message.set(String(error)); }
      this.revision.set(await this.cache.active(this.namespace, this.source));
      const revision = this.revision();
      if (revision && requiresContentReimport(revision)) {
        this.message.set('Reimport required: the installed library uses an older adapter or schema snapshot. Saved characters remain available.');
      }
      await this.refreshStorage();
    } catch (error) { this.message.set(String(error)); }
    finally { this.busy.set(false); }
  }

  async check(): Promise<void> {
    if (this.busy() || this.checkingRules()) return;
    const controller = new AbortController();
    this.rulesCheck = controller;
    this.checkingRules.set(true);
    this.updateMessage.set('Checking for updates…');
    try {
      const source = validateSource(this.source);
      const installed = await this.cache.active(this.namespace, source);
      if (this.rulesCheck !== controller) return;
      if (installed && requiresContentReimport(installed)) {
        this.updateMessage.set('Reimport required: the installed library uses an older adapter or schema snapshot.');
        return;
      }
      const head = await resolveCommit(source, undefined, controller.signal);
      if (this.rulesCheck === controller) this.updateMessage.set(installed?.commit === head ? 'Installed content is current.' : `Revision ${head.slice(0, 12)} is available. Import when ready.`);
    } catch (error) { if (this.rulesCheck === controller) this.updateMessage.set(String(error)); }
    finally {
      if (this.rulesCheck === controller) { this.rulesCheck = undefined; this.checkingRules.set(false); }
    }
  }
  async start(): Promise<void> {
    if (this.busy()) return;
    this.updateMessage.set('');
    this.busy.set(true);
    try {
      const source = validateSource(this.source);
      await this.cache.saveSource(this.namespace, source);
      await this.runImport({ action: 'import', namespace: this.namespace, source });
    } catch (error) { this.busy.set(false); this.message.set(String(error)); }
  }
  chooseHomebrew(event: Event) {
    this.homebrewFile = (event.target as HTMLInputElement).files?.[0];
  }
  async removeHomebrew(fileId: string) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const source = validateSource(await this.cache.savedSource(this.namespace) ?? this.source);
      await this.runImport({ action: 'remove-homebrew', namespace: this.namespace, source, fileId });
    } catch (error) { this.busy.set(false); this.message.set(String(error)); }
  }
  async checkHomebrew(fileId: string) {
    if (this.busy() || this.homebrewChecks.has(fileId)) return;
    const revision = this.revision();
    const file = revision?.homebrewFiles?.find(file => file.id === fileId);
    if (!revision || !file?.url) return;
    let worker: Worker | undefined;
    const finish = (text: string) => {
      if (this.homebrewChecks.get(fileId) !== worker) return;
      this.homebrewChecks.delete(fileId);
      this.checkingHomebrewFiles.update(ids => { const next = new Set(ids); next.delete(fileId); return next; });
      worker?.terminate();
      if (this.revision()?.id === revision.id) this.homebrewMessages.update(messages => ({ ...messages, [fileId]: text }));
    };
    try {
      if (typeof Worker === 'undefined') throw new Error('Update checks require browser Web Workers.');
      const source = validateSource(revision.source);
      worker = new Worker(new URL('./content.worker', import.meta.url), { type: 'module' });
      this.homebrewChecks.set(fileId, worker);
      this.checkingHomebrewFiles.update(ids => new Set([...ids, fileId]));
      this.homebrewMessages.update(messages => ({ ...messages, [fileId]: 'Checking for updates…' }));
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') return;
        if (data.type === 'homebrew-checked' && data.fileId === fileId) {
          finish(data.revisionId && data.revisionId !== revision.id ? 'The library changed. Refresh this page and check again.'
            : data.state === 'current' ? 'Installed homebrew is current.' : 'Updated content is available. Choose Update to install it.');
        } else finish(data.message ?? 'The update check did not return a result. Please try again.');
      };
      worker.onerror = () => finish('The update check stopped unexpectedly. Please try again.');
      worker.postMessage({ action: 'check-homebrew', namespace: this.namespace, source, fileId });
    } catch (error) {
      if (worker) finish(String(error));
      else this.homebrewMessages.update(messages => ({ ...messages, [fileId]: String(error) }));
    }
  }
  async refreshHomebrew(fileId: string) {
    if (this.busy()) return;
    const revision = this.revision();
    const file = revision?.homebrewFiles?.find(file => file.id === fileId);
    if (!revision || !file?.url) return;
    this.busy.set(true);
    try {
      await this.runImport({ action: 'update-homebrew', namespace: this.namespace, source: validateSource(revision.source), fileId });
    } catch (error) {
      this.busy.set(false); this.message.set(String(error));
      this.homebrewMessages.update(messages => ({ ...messages, [fileId]: String(error) }));
    }
  }
  private cancelUpdateChecks() {
    if (this.rulesCheck) {
      this.rulesCheck.abort(); this.rulesCheck = undefined; this.checkingRules.set(false);
      this.updateMessage.set('Update check cancelled.');
    }
    for (const [fileId, worker] of this.homebrewChecks) {
      worker.terminate();
      this.homebrewMessages.update(messages => ({ ...messages, [fileId]: 'Update check cancelled.' }));
    }
    this.homebrewChecks.clear(); this.checkingHomebrewFiles.set(new Set());
  }
  async startHomebrew(from: 'url' | 'file') {
    if (this.busy()) return;
    if (from === 'file' && !this.homebrewFile) return;
    if (from === 'url' && !this.homebrewUrl.trim()) return;
    this.busy.set(true);
    try {
      // Add to the installed source rather than any unsaved edits to the repository form.
      const source = validateSource(await this.cache.savedSource(this.namespace) ?? this.source);
      await this.cache.saveSource(this.namespace, source);
      await this.runImport({ action: 'homebrew', namespace: this.namespace, source,
        ...(from === 'url' ? { url: this.homebrewUrl.trim() } : { file: this.homebrewFile }) });
    } catch (error) { this.busy.set(false); this.message.set(String(error)); }
  }
  private async runImport(request: Exclude<ContentImportRequest, { action: 'cancel' | 'check-homebrew' }>) {
    if (typeof Worker === 'undefined') throw new Error('Content imports require browser Web Workers.');
    this.busy.set(true);
    this.cancelUpdateChecks();
    if (request.action === 'update-homebrew') this.homebrewMessages.update(messages => ({ ...messages, [request.fileId]: 'Updating…' }));
    this.diagnostics.set([]);
    this.progress.set(null);
    this.revision.set(await this.cache.active(this.namespace, request.source));
    const estimate = await navigator.storage?.estimate();
    this.message.set(estimate?.quota ? `Available browser storage: ${this.mb(estimate.quota - (estimate.usage ?? 0))} MB. Importing…` : 'Importing…');
    await navigator.storage?.persist?.();
    this.worker = new Worker(new URL('./content.worker', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'progress') this.progress.set(data.progress);
      else {
        this.importing.set(false);
        this.busy.set(false);
        this.diagnostics.set(data.diagnostics ?? data.revision?.diagnostics ?? []);
        if (data.type === 'complete') {
          this.homebrewMessages.set({});
          if (request.action === 'update-homebrew') this.homebrewMessages.set({ [request.fileId]: 'Homebrew updated to the latest contents at its URL.' });
          this.revision.set(data.revision);
          this.message.set(request.action === 'remove-homebrew' ? 'Homebrew file removed. Saved characters were not changed.'
            : request.action === 'update-homebrew' ? 'Homebrew file updated. Saved characters were not changed.'
            : request.action === 'homebrew' ? 'Homebrew file imported. Saved characters were not changed.' : 'Content imported. Saved characters were not changed.');
        } else {
          this.message.set(data.message);
          if (request.action === 'update-homebrew') {
            this.homebrewMessages.update(messages => ({ ...messages, [request.fileId]: data.message }));
          }
        }
        this.worker?.terminate(); this.worker = undefined;
        void this.refreshStorage();
      }
    };
    this.worker.onerror = () => {
      this.importing.set(false);
      if (request.action === 'update-homebrew') this.homebrewMessages.update(messages => ({ ...messages, [request.fileId]: 'The operation stopped. Please try again.' }));
      this.message.set('The background importer stopped unexpectedly. The previous revision remains active.');
      this.worker?.terminate(); this.worker = undefined;
      void this.recoverStoppedImport();
    };
    this.worker.postMessage(request);
    this.importing.set(true);
  }
  cancel(): void { this.worker?.postMessage({ action: 'cancel' }); }
  async refreshStorage(): Promise<void> {
    try {
      this.cachedRevisions.set(await this.cache.revisions(this.namespace));
      this.storage.set(await navigator.storage?.estimate());
    } catch (error) { this.message.set(String(error)); }
  }
  private async recoverStoppedImport(): Promise<void> {
    try { await this.cache.recover(this.namespace); }
    catch (error) { this.message.set(String(error)); }
    await this.refreshStorage();
    this.busy.set(false);
  }
  async removeRevision(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    this.cancelUpdateChecks();
    this.removal.set({ revisionId: id, phase: 'checking', records: 0 });
    try {
      await this.cache.deleteRevision(this.namespace, id, progress => this.removal.set({ ...progress, revisionId: id }));
      this.revision.set(await this.cache.active(this.namespace, this.source));
      this.message.set('Inactive revision removed. Installed content and character snapshots retained.');
      await this.refreshStorage();
    } catch (error) { this.message.set(String(error)); }
    finally { this.removal.set(null); this.busy.set(false); }
  }
  mb(bytes: number): string { return (bytes / 1024 / 1024).toFixed(1); }
  ngOnDestroy(): void {
    this.cancelUpdateChecks();
    // Let cancellation discard staging data before shutting down the worker.
    const worker = this.worker;
    if (worker) {
      worker.onmessage = ({ data }) => { if (data.type !== 'progress') worker.terminate(); };
      worker.postMessage({ action: 'cancel' });
    }
  }
}
