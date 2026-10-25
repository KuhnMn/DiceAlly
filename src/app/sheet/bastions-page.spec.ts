import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { emptyBasicCharacter } from '../editor/basic-info';
import { BastionsPageComponent } from './bastions-page.component';
import { BastionPlanComponent } from './bastion-plan.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { bastionPlanUrl } from '../models/bastion';
import { FacilityEntry } from '../models/bastion';

function facility(): FacilityEntry {
  return { editorId: 'study', name: 'Arcane Study', source: 'XDMG', entity: { version: 1, name: 'Arcane Study', source: 'XDMG', facilityType: 'special', level: 5,
    prerequisite: [{ spellcasting: true }], entries: ['Study spells in this room.'] }, notes: [{ tag: 'Projects', notes: ['Old tower'], isEditable: true }] };
}

describe('Bastion viewer and plan', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('opens full facility details and prerequisites, edits the same notes on cards and dialogs, and searches without affecting the saved list', () => {
    const sheet = emptyBasicCharacter(), entry = facility(); sheet.bastion = { facilities: [entry] };
    const fixture = TestBed.createComponent(BastionsPageComponent); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    fixture.nativeElement.querySelector('article button').click(); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.textContent).toContain('Study spells in this room.'); expect(dialog.textContent).toContain('Ability to cast at least one spell');
    expect(dialog.textContent).toContain('Level 5'); expect(dialog.textContent).toContain('Special');
    expect(fixture.nativeElement.querySelector('app-feature-uses')).toBeNull();
    const notes = fixture.debugElement.queryAll(By.directive(FeatureNotesComponent)).at(-1)!.componentInstance as FeatureNotesComponent;
    notes.startAdding(0); notes.addingText.set('New project'); notes.confirmAdd(); fixture.detectChanges();
    expect(entry.notes![0].notes).toEqual(['Old tower', 'New project']);
    expect(fixture.nativeElement.querySelector('article').textContent).toContain('New project');
    fixture.componentInstance.detail.set(null); fixture.componentInstance.query.set('missing'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article')).toBeNull(); expect(sheet.bastion.facilities).toHaveLength(1);
  });

  it('hides absent plans, validates external URLs, provides a failed-image fallback and retries when the URL changes', () => {
    expect(bastionPlanUrl('javascript:alert(1)')).toBeNull(); expect(bastionPlanUrl('data:image/png;base64,abc')).toBeNull(); expect(bastionPlanUrl('/map.png')).toBeNull();
    const fixture = TestBed.createComponent(BastionPlanComponent); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('section')).toBeNull();
    fixture.componentRef.setInput('value', 'https://example.com/map.png'); fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement; expect(img.alt).toBe('Bastion plan');
    img.dispatchEvent(new Event('error')); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('could not be loaded');
    expect(fixture.nativeElement.querySelector('a').href).toBe('https://example.com/map.png');
    fixture.componentRef.setInput('value', 'https://example.com/new.png'); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('img').src).toBe('https://example.com/new.png');
    fixture.componentRef.setInput('value', 'bad url'); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('img')).toBeNull(); expect(fixture.nativeElement.textContent).toContain('http:// or https://');
  });
});
