import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CharacterLibraryService } from './character-library.service';
import { CharacterUpdateNoticeComponent } from './character-update-notice.component';

describe('Character update notice', () => {
  it('announces newer persisted versions without refreshing until requested', async () => {
    const changed = signal(0);
    let version = 1;
    let deleted = false;
    let conflict = false;
    const showSyncConflicts = signal(false);
    TestBed.configureTestingModule({ providers: [{ provide: CharacterLibraryService, useValue: {
      changed, showSyncConflicts, get: async () => deleted ? undefined : { version, conflict: conflict ? {} : undefined },
    } }] });
    const fixture = TestBed.createComponent(CharacterUpdateNoticeComponent);
    fixture.componentRef.setInput('characterId', 'hero');
    fixture.componentRef.setInput('loadedVersion', 1);
    fixture.componentRef.setInput('characterName', 'Test Hero');
    let refreshes = 0;
    fixture.componentInstance.refresh.subscribe(() => refreshes++);
    await fixture.whenStable();
    expect(fixture.componentInstance.available()).toBe(false);
    version = 2; changed.update(value => value + 1);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Updated Version Available');
    expect(fixture.nativeElement.textContent).toContain('Test Hero');
    expect(refreshes).toBe(0);
    fixture.nativeElement.querySelector('button').click();
    expect(refreshes).toBe(1);
    fixture.componentRef.setInput('loadedVersion', 2);
    await fixture.whenStable();
    expect(fixture.componentInstance.available()).toBe(false);
    deleted = true; changed.update(value => value + 1);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('deleted');
    deleted = false; conflict = true; changed.update(value => value + 1);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Conflicting Character Versions');
    fixture.nativeElement.querySelector('button').click();
    expect(showSyncConflicts()).toBe(true);
    expect(refreshes).toBe(1);
  });
});
