import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { ContentImportComponent } from './content-import.component';
import { IndexedDbContentCache, RevisionRemovalProgress } from './content-cache';

describe('Inactive revision cleanup feedback', () => {
  afterEach(() => vi.restoreAllMocks());

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
});
