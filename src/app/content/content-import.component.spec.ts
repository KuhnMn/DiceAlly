import { DEFAULT_CONTENT_SOURCE, HomebrewFile, ImportRevision, sourceIdentity } from './content.model';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { ContentImportComponent } from './content-import.component';
import { IndexedDbContentCache, RevisionRemovalProgress } from './content-cache';

describe('Inactive revision cleanup feedback', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  async function setup() {
    vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(undefined);
    vi.spyOn(IndexedDbContentCache.prototype, 'recover').mockResolvedValue(0);
    vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue(undefined);
    vi.spyOn(IndexedDbContentCache.prototype, 'revisions').mockResolvedValue([]);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ContentImportComponent);
    fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.ngOnInit();
    return { fixture, component: fixture.componentInstance };
  }

  it('shows nonblocking warnings with their file and source field path', async () => {
    const {fixture, component} = await setup();
    component.diagnostics.set([{severity: 'warning', code: 'schema-metadata', file: 'spells/test.json', path: '/spell/0/miscTags', message: 'Unknown optional metadata tag. Stored unchanged.'}]);
    fixture.detectChanges();
    expect(component.hasImportErrors()).toBe(false);
    const details = [...fixture.nativeElement.querySelectorAll('details')].find((element: unknown) => (element as HTMLElement).textContent?.includes('Import Diagnostics')) as HTMLDetailsElement;
    expect(details.querySelector('summary')?.textContent).toContain('Warnings');
    expect(details.textContent).toContain('/spell/0/miscTags'); expect(details.textContent).toContain('spells/test.json');
    expect(details.querySelector('.text-error')).toBeNull();
  });

  it('shows cleanup phases and record count, then clears the activity after completion', async () => {
    let progress!: (value: RevisionRemovalProgress) => void;
    let finish!: () => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'deleteRevision').mockImplementation((_namespace, _id, report) => {
      progress = report!;
      return new Promise<void>(resolve => { finish = resolve; });
    });
    const { fixture, component } = await setup();
    const pending = component.removeRevision('old-revision');
    fixture.detectChanges();
    expect(component.busy()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Preparing to remove');
    progress({ phase: 'deleting', records: 22000 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(`${(22000).toLocaleString()} imported records`);
    expect(fixture.nativeElement.querySelector('progress[aria-label="Removing inactive revision"]')).not.toBeNull();
    progress({ phase: 'complete', records: 22000 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Updating storage totals');
    finish(); await pending; fixture.detectChanges();
    expect(component.busy()).toBe(false);
    expect(component.removal()).toBeNull();
    expect(fixture.nativeElement.querySelector('progress[aria-label="Removing inactive revision"]')).toBeNull();
    expect(component.message()).toContain('Inactive revision removed');
  });

  it('clears the activity and reports a failed cleanup', async () => {
    vi.spyOn(IndexedDbContentCache.prototype, 'deleteRevision').mockRejectedValue(new Error('Cleanup failed'));
    const { component } = await setup();
    await component.removeRevision('old-revision');
    expect(component.removal()).toBeNull();
    expect(component.busy()).toBe(false);
    expect(component.message()).toContain('Cleanup failed');
  });
  class FakeWorker {
    static instances: FakeWorker[] = [];
    postMessage = vi.fn();
    terminate = vi.fn();
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { FakeWorker.instances.push(this); }
    receive(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
  }
  async function installedHomebrew() {
    const result = await setup();
    const file: HomebrewFile = { id: 'remote', name: 'brew.json', url: 'https://example.org/brew.json', digest: 'old', importedAt: '', sources: ['BREW'], document: {} };
    const base: ImportRevision = { id: 'base', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
      sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 1, status: 'ready',
      createdAt: '', files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 },
      homebrewFiles: [file, { ...file, id: 'local', name: 'local.json', url: undefined }] };
    result.component.revision.set(base);
    vi.mocked(IndexedDbContentCache.prototype.active).mockResolvedValue(base);
    vi.mocked(IndexedDbContentCache.prototype.savedSource).mockResolvedValue(base.source);
    FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker);
    result.fixture.detectChanges();
    return { ...result, base, file };
  }
  it('offers update and check only for saved URLs and explains local uploads', async () => {
    const { fixture } = await installedHomebrew();
    expect(fixture.nativeElement.querySelector('button[aria-label="Update brew.json"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Check for updates to brew.json"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Update local.json"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Select the JSON file again to update it');
  });
  it.each(['current', 'available'])('checks for %s content without installing a revision', async state => {
    const { component, fixture, base, file } = await installedHomebrew();
    const before = structuredClone(base);
    await component.refreshHomebrew(file.id, true);
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ action: 'check-homebrew', namespace: 'development-local', source: base.source, fileId: file.id });
    expect(component.checkingHomebrew()).toBe(true); expect(component.busy()).toBe(true);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Checking Homebrew for Updates');
    await component.refreshHomebrew(file.id);
    expect(FakeWorker.instances).toHaveLength(1);
    worker.receive({ type: 'homebrew-checked', fileId: file.id, state });
    expect(component.revision()).toBe(base); expect(base).toEqual(before);
    expect(component.homebrewMessages()[file.id]).toContain(state === 'current' ? 'is current' : 'available');
    expect(component.busy()).toBe(false); expect(component.checkingHomebrew()).toBe(false);
    expect(worker.terminate).toHaveBeenCalled();
  });
  it('updates the installed source and file rather than unsaved form inputs', async () => {
    const { component, base, file } = await installedHomebrew();
    component.source = { ...DEFAULT_CONTENT_SOURCE, owner: 'unsaved' }; component.homebrewUrl = 'https://other.org/wrong.json';
    await component.refreshHomebrew(file.id);
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ action: 'update-homebrew', namespace: 'development-local', source: base.source, fileId: file.id });
    const updated = { ...base, id: 'new-revision', homebrewFiles: [{ ...file, digest: 'new' }] };
    worker.receive({ type: 'complete', revision: updated });
    expect(component.revision()).toBe(updated); expect(component.message()).toContain('updated');
    expect(component.busy()).toBe(false);
  });
  it('keeps the installed revision on a failed check or update and permits a retry', async () => {
    const { component, base, file } = await installedHomebrew();
    await component.refreshHomebrew(file.id, true);
    FakeWorker.instances[0].receive({ type: 'error', message: 'Download failed (404)' });
    expect(component.revision()).toBe(base); expect(component.homebrewMessages()[file.id]).toContain('404');
    expect(component.busy()).toBe(false);
    await component.refreshHomebrew(file.id);
    FakeWorker.instances[1].receive({ type: 'error', message: 'Invalid homebrew JSON' });
    expect(component.revision()).toBe(base); expect(component.homebrewMessages()[file.id]).toContain('Invalid');
    expect(component.busy()).toBe(false);
  });
  it('does not start workers for missing files or local uploads', async () => {
    const { component } = await installedHomebrew();
    await component.refreshHomebrew('local'); await component.refreshHomebrew('missing', true);
    expect(FakeWorker.instances).toHaveLength(0); expect(component.busy()).toBe(false);
  });

});
