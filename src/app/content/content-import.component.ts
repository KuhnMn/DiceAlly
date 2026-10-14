import { Component, OnDestroy, OnInit, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from './content-cache';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportDiagnostic, ImportProgress, ImportRevision, validateSource } from './content.model';
import { ContentImportRequest } from './content-import-request';
import { resolveCommit } from './github-source';
import { ItemView, resolveItemView } from './item-resolver';

@Component({
  selector: 'app-content-import', imports: [FormsModule, RouterLink],
  styleUrl: '../editor/local-editor.component.css',
  template: `
    <main class="max-w-[1000px] mx-auto my-8 p-4 [overflow-wrap:anywhere]">
      <a routerLink="/">Back to characters</a>
      <h1 class="text-3xl font-bold my-4">Content import prototype</h1>
      <p class="mb-4">Development preview. Content stays on this device. Account access will be added before release.</p>
      <form (ngSubmit)="start()" class="grid gap-3">
        <fieldset [disabled]="busy()" class="grid gap-3 min-w-0">
          <label>GitHub owner <input name="owner" [(ngModel)]="source.owner" required class="border rounded p-2 w-full" /></label>
          <label>Repository <input name="repository" [(ngModel)]="source.repository" required class="border rounded p-2 w-full" /></label>
          <label>Branch <input name="branch" [(ngModel)]="source.branch" required class="border rounded p-2 w-full" /></label>
          <label>Data directory <input name="directory" [(ngModel)]="source.directory" required class="border rounded p-2 w-full" /></label>
          <div class="flex flex-wrap gap-3">
            <button type="button" (click)="check()" class="border rounded p-2">Check for updates</button>
            <button type="submit" class="bg-primary text-on-primary rounded p-2">Import / reimport content</button>
          </div>
        </fieldset>
      </form>
      <section class="editor-card my-5">
        <h2>Homebrew Files</h2>
        <p class="text-sm text-on-surface-variant mb-3">Add one 5etools homebrew JSON file at a time. It joins your installed library; other files and dependencies are not downloaded automatically.</p>
        <fieldset [disabled]="busy()" class="min-w-0 space-y-3">
          <label class="block"><span class="field-label">JSON File URL</span>
            <input class="editor-input" type="url" name="homebrew-url" [(ngModel)]="homebrewUrl" placeholder="https://raw.githubusercontent.com/…/collection/….json" />
          </label>
          <button type="button" class="action-button" [disabled]="!homebrewUrl.trim()" (click)="startHomebrew('url')">Import URL</button>
          <div class="border-t border-outline-variant pt-3">
            <input #homebrewUpload id="homebrew-upload" type="file" class="hidden" accept=".json,application/json" (change)="chooseHomebrew($event)" />
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="secondary-button" (click)="homebrewUpload.click()">Choose JSON File</button>
              <button type="button" class="action-button" [disabled]="!homebrewFile" (click)="startHomebrew('file')">Import File</button>
            </div>
            @if (homebrewFile; as file) { <p class="text-xs text-on-surface-variant mt-2 break-words">{{ file.name }} · {{ mb(file.size) }} MB</p> }
          </div>
        </fieldset>
        @if (revision()?.homebrewFiles?.length) {
          <h3 class="font-semibold mt-4 mb-2">Installed Homebrew</h3>
          @for (file of revision()?.homebrewFiles ?? []; track file.id) {
            <p class="text-sm break-words">{{ file.name }} <span class="text-xs text-on-surface-variant">· {{ file.sources.join(', ') }}</span></p>
          }
          <p class="text-xs text-on-surface-variant mt-2">Importing the same file again updates it. Selected homebrew files are retained when reimporting the main library. Saved characters keep their existing snapshots.</p>
        }
      </section>
      @if (busy()) { <button (click)="cancel()" class="border rounded p-2 my-3">Cancel import</button> }
      <p role="status" aria-live="polite" class="my-3">{{ message() }}</p>
      @if (progress(); as p) {
        <p>{{ p.phase }}:
          @if (p.phase === 'download') { {{ p.completed }} / {{ p.total }} files · }
          @if (p.phase === 'link') { {{ p.completed }} / {{ p.total }} records processed · }
          {{ p.records }} records · {{ mb(p.bytes) }} MB</p>
        <p class="break-all">{{ p.file }}</p>
      }
      @if (revision(); as r) {
        <section class="my-4">
          <h2 class="text-xl font-bold">Installed revision</h2>
          <p class="break-all">{{ r.commit }}</p>
          <p>{{ r.metrics.records }} records · {{ mb(r.metrics.bytes) }} MB imported · {{ mb(r.metrics.mappedBytes) }} MB mapped · {{ r.metrics.elapsedMs / 1000 }} seconds</p>
          <label class="block my-2">Browse imported content
            <select [(ngModel)]="browseKind" (ngModelChange)="browse(r.id)" class="editor-input mt-2 sm:mt-0 sm:w-auto sm:ml-2">
              <option value="class">Classes</option><option value="species">Species</option><option value="item">Items</option><option value="spell">Spells</option><option value="feat">Feats</option><option value="optionalfeature">Optional Features</option>
            </select>
          </label>
          <button (click)="browse(r.id)" class="border rounded p-2 my-2">Show first 100 records</button>
          @for (record of records(); track record.key) {
            <p>{{ record.name }} ({{ record.publication }}) · {{ record.links.length }} resolved links</p>
            @if (itemViews()[record.key]; as display) {
              <p>{{ display.itemType }} · Properties: @for (p of display.properties; track p.key) { {{ p.name }} }
                · Masteries: @for (m of display.masteries; track m.key) { {{ m.name }} }</p>
            }
          }
        </section>
      }
      @if (diagnostics().length) {
        <h2 class="text-xl font-bold">Import diagnostics ({{ diagnostics().length }})</h2>
        <p>Showing the first 100. A failed import leaves the installed revision unchanged.</p>
        @for (d of diagnostics().slice(0, 100); track $index) {
          <p class="break-all my-2">{{ d.severity }} · {{ d.file }} · {{ d.message }}</p>
        }
      }
      <section class="my-6">
        <h2 class="text-xl font-bold">Local content storage</h2>
        <p>Old content can be removed here. Active revisions are protected. Character snapshots are stored separately.</p>
        <button [disabled]="busy()" (click)="refreshStorage()" class="border rounded p-2 my-2">Refresh storage</button>
        @if (storage(); as s) { <p>{{ mb(s.usage ?? 0) }} MB used / {{ mb(s.quota ?? 0) }} MB browser allowance (entire site)</p> }
        @for (entry of cachedRevisions(); track entry.revision.id) {
          <div class="border rounded p-3 my-2">
            <p>{{ entry.revision.source.owner }}/{{ entry.revision.source.repository }} / {{ entry.revision.source.branch }}</p>
            <p>{{ entry.revision.commit.slice(0, 12) }} · {{ entry.revision.createdAt }} · adapter {{ entry.revision.adapterVersion }}</p>
            <p>{{ entry.active ? 'Active' : entry.revision.status === 'staging' ? 'Incomplete import' : 'Retained' }} · {{ entry.storedRecords }} records
              @if (entry.revision.status === 'ready') { · {{ mb(entry.revision.metrics.mappedBytes) }} MB serialized data }
            </p>
            <button [disabled]="busy() || entry.active" (click)="removeRevision(entry.revision.id)" class="border rounded p-2">Remove inactive revision</button>
          </div>
        }
      </section>
    </main>
  `,
})
export class ContentImportComponent implements OnInit, OnDestroy {
  source = { ...DEFAULT_CONTENT_SOURCE };
  homebrewUrl = '';
  homebrewFile?: File;
  browseKind = 'class';
  readonly busy = signal(false);
  readonly message = signal('Check for updates or explicitly import content.');
  readonly progress = signal<ImportProgress | null>(null);
  readonly revision = signal<ImportRevision | undefined>(undefined);
  readonly diagnostics = signal<ImportDiagnostic[]>([]);
  readonly records = signal<ContentRecord[]>([]);
  readonly itemViews = signal<Record<string, ItemView>>({});
  readonly cachedRevisions = signal<Awaited<ReturnType<IndexedDbContentCache['revisions']>>>([]);
  readonly storage = signal<StorageEstimate | undefined>(undefined);
  private readonly cache = new IndexedDbContentCache();
  private worker?: Worker;
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
      await this.refreshStorage();
    } catch (error) { this.message.set(String(error)); }
    finally { this.busy.set(false); }
  }

  async check(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const source = validateSource(this.source);
      await this.cache.saveSource(this.namespace, source);
      const installed = await this.cache.active(this.namespace, source);
      this.revision.set(installed);
      const head = await resolveCommit(source);
      this.message.set(installed?.commit === head ? 'Installed content is current.' : `Revision ${head.slice(0, 12)} is available. Import when ready.`);
    } catch (error) { this.message.set(String(error)); }
    finally { this.busy.set(false); }
  }
  async start(): Promise<void> {
    if (this.busy() || !isDevMode()) return;
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
  async startHomebrew(from: 'url' | 'file') {
    if (this.busy() || !isDevMode()) return;
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
  private async runImport(request: Exclude<ContentImportRequest, { action: 'cancel' }>) {
    if (typeof Worker === 'undefined') throw new Error('Content imports require browser Web Workers.');
    this.busy.set(true);
    this.diagnostics.set([]);
    this.records.set([]);
    this.progress.set(null);
    this.revision.set(await this.cache.active(this.namespace, request.source));
    const estimate = await navigator.storage?.estimate();
    this.message.set(estimate?.quota ? `Available browser storage: ${this.mb(estimate.quota - (estimate.usage ?? 0))} MB. Importing…` : 'Importing…');
    await navigator.storage?.persist?.();
    this.worker = new Worker(new URL('./content.worker', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'progress') this.progress.set(data.progress);
      else {
        this.busy.set(false);
        this.diagnostics.set(data.diagnostics ?? data.revision?.diagnostics ?? []);
        if (data.type === 'complete') {
          this.revision.set(data.revision);
          this.message.set(request.action === 'homebrew' ? 'Homebrew file imported. Saved characters were not changed.' : 'Content imported. Saved characters were not changed.');
        } else this.message.set(data.message);
        this.worker?.terminate(); this.worker = undefined;
        void this.refreshStorage();
      }
    };
    this.worker.onerror = () => {
      this.message.set('The background importer stopped unexpectedly. The previous revision remains active.');
      this.worker?.terminate(); this.worker = undefined;
      void this.recoverStoppedImport();
    };
    this.worker.postMessage(request);
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
    try {
      await this.cache.deleteRevision(this.namespace, id);
      this.revision.set(await this.cache.active(this.namespace, this.source));
      this.records.set([]); this.itemViews.set({});
      this.message.set('Inactive content removed. Installed content and character snapshots retained.');
      await this.refreshStorage();
    } catch (error) { this.message.set(String(error)); }
    finally { this.busy.set(false); }
  }
  async browse(id: string): Promise<void> {
    try {
      const records = await this.cache.category(id, this.browseKind);
      const views = await Promise.all(records.filter(record => record.kind === 'item').map(async record =>
        [record.key, await resolveItemView(this.cache, id, record)] as const));
      this.itemViews.set(Object.fromEntries(views));
      this.records.set(records);
    }
    catch (error) { this.message.set(String(error)); }
  }
  mb(bytes: number): string { return (bytes / 1024 / 1024).toFixed(1); }
  ngOnDestroy(): void {
    // Let cancellation discard staging data before shutting down the worker.
    const worker = this.worker;
    if (worker) {
      worker.onmessage = ({ data }) => { if (data.type !== 'progress') worker.terminate(); };
      worker.postMessage({ action: 'cancel' });
    }
  }
}
