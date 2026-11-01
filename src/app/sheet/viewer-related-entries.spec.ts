import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision } from '../content/content.model';
import { ContentReference } from '../models/character.model';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { ViewerRelatedEntriesService } from './viewer-related-entries.service';
import { RelatedEntriesListComponent } from '../compendium/related-entries-list.component';

const revision: ImportRevision = {
  id: 'current', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: 'source', commit: 'current-commit', adapterVersion: 1, createdAt: '',
  status: 'ready', files: [], diagnostics: [], metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 },
};
const reference: ContentReference = { key: 'feature|test', sourceIdentity: 'source', revisionId: 'old', commit: 'old-commit' };
const linked: ContentRecord = { key: 'spell|test', kind: 'spell', name: 'Linked spell', publication: 'XPHB', file: '', data: { level: 0, entries: ['Local spell description'] }, links: [] };
const record: ContentRecord = { key: reference.key, kind: 'feat', name: 'Original feature', publication: 'XPHB', file: '', data: {}, links: [
  { role: 'spell', target: linked.key, status: 'resolved', scope: 'description' },
  { role: 'spell', target: linked.key, status: 'resolved' },
  { role: 'source', target: 'ignored', scope: 'provenance' },
  { role: 'spell', target: 'missing', status: 'missing' },
] };

@Component({
  imports: [SheetDetailDialogComponent],
  template: `<app-sheet-detail-dialog title="Saved feature" [reference]="reference"><textarea aria-label="Saved note">Keep my draft</textarea></app-sheet-detail-dialog>`,
})
class DetailHost { readonly reference = reference; }

describe('Dynamic viewer library links', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps compendium links expanded by default and lets the summary collapse them', () => {
    const fixture = TestBed.createComponent(RelatedEntriesListComponent);
    fixture.componentRef.setInput('entries', [linked]); fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    details.querySelector('summary')!.click(); fixture.detectChanges();
    expect(details.open).toBe(false);
    details.querySelector('summary')!.click(); fixture.detectChanges();
    expect(details.open).toBe(true);
    const opened = vi.fn(); fixture.componentInstance.opened.subscribe(opened);
    details.querySelector('button')!.click();
    expect(opened).toHaveBeenCalledWith(linked);
    expect(details.open).toBe(true);
  });

  function cache(active: ImportRevision | undefined = revision) {
    vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(DEFAULT_CONTENT_SOURCE);
    vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue(active);
    vi.spyOn(IndexedDbContentCache.prototype, 'revisions').mockResolvedValue([
      { revision: { ...revision, id: 'old' }, active: false, storedRecords: 2 },
    ]);
    return vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementation(async (_revision, key) =>
      key === record.key ? structuredClone(record) : key === linked.key ? structuredClone(linked) : undefined);
  }

  it('uses the current local revision, deduplicates links and never saves enrichment on the reference', async () => {
    const get = cache();
    const before = structuredClone(reference);
    const put = vi.spyOn(IndexedDbContentCache.prototype, 'put');
    const value = await new ViewerRelatedEntriesService().load(reference, () => true);
    expect(value?.revision.id).toBe('current');
    expect(value?.related).toEqual([linked]);
    expect(get.mock.calls).toEqual([['current', record.key], ['current', linked.key]]);
    expect(reference).toEqual(before);
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps source identities separate and uses a locally retained revision for another source', async () => {
    const get = cache({ ...revision, sourceIdentity: 'another-source' });
    expect((await new ViewerRelatedEntriesService().load(reference, () => true))?.revision.id).toBe('old');
    expect(get.mock.calls[0]).toEqual(['old', record.key]);
    expect(await new ViewerRelatedEntriesService().load({ ...reference, sourceIdentity: 'unknown' }, () => true)).toBeNull();
  });

  it('leaves unavailable entries alone and stops obsolete loads before reading their records', async () => {
    const get = cache();
    const service = new ViewerRelatedEntriesService();
    expect(await service.load(reference, () => false)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(await service.load({ ...reference, key: 'not-in-library' }, () => true)).toBeNull();
  });

  it('navigates linked details in one dialog and returns to the same unsaved note', async () => {
    const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    const service = {
      load: vi.fn().mockResolvedValue({ record, revision, related: [linked] }),
      open: vi.fn().mockResolvedValue({ record: linked, revision, related: [record] }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ViewerRelatedEntriesService, useValue: service }] });
    const fixture = TestBed.createComponent(DetailHost);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const note = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'Unsaved draft';
    const related = fixture.nativeElement.querySelector('app-related-entries-list details') as HTMLDetailsElement;
    expect(related.open).toBe(false);
    related.querySelector('summary')!.click(); fixture.detectChanges();
    expect(related.open).toBe(true);
    fixture.nativeElement.querySelector('app-related-entries-list button').click();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('dialog').length).toBe(1);
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Linked spell');
    const linkedRelated = fixture.nativeElement.querySelector('app-compendium-details app-related-entries-list details') as HTMLDetailsElement;
    expect(linkedRelated.open).toBe(false);
    fixture.nativeElement.querySelector('button[aria-label="Back to previous entry"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Saved feature');
    expect(fixture.nativeElement.querySelector('textarea')).toBe(note);
    expect(note.value).toBe('Unsaved draft');
    expect(related.open).toBe(true);
    fixture.destroy();
    if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
});
