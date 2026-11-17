import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SourceBookOptionComponent } from './source-book-option.component';
import { SourceBookNamesService } from './source-book-names.service';
import { CompendiumSourceFilterComponent } from '../compendium/compendium-source-filter.component';
import { HomebrewFile, ImportRevision } from '../content/content.model';

function importedRevision(): Pick<ImportRevision, 'homebrewFiles'> {
  const file = (id: string, full: string, profile: HomebrewFile['profile']): HomebrewFile => ({
    id, name: `${id}.json`, profile, digest: '', importedAt: '', sources: [id],
    document: { _meta: { sources: [{ json: id, full }] } },
  });
  return { homebrewFiles: [file('MYBREW', 'My Homebrew Collection', 'brew'), file('XUATEST', 'Unearthed Arcana: Test Options', 'ua')] };
}

describe('Source book titles', () => {
  it('switches between abbreviation and full title without changing the checkbox selection', async () => {
    const fixture = TestBed.createComponent(SourceBookOptionComponent);
    fixture.componentRef.setInput('book', 'XPHB');
    fixture.componentRef.setInput('selected', true);
    const selection = vi.fn();
    fixture.componentInstance.selectedChange.subscribe(selection);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('button')!;
    const checkbox = root.querySelector('input')!;
    expect(root.querySelector('label')?.textContent?.trim()).toBe('XPHB');
    button.click(); fixture.detectChanges();
    expect(root.querySelector('label')?.textContent).toContain("Player's Handbook (2024)");
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(checkbox.checked).toBe(true);
    expect(selection).not.toHaveBeenCalled();
    button.click(); fixture.detectChanges();
    expect(root.querySelector('label')?.textContent?.trim()).toBe('XPHB');
    checkbox.click();
    expect(selection).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('uses imported titles for both profiles, clears removed metadata and preserves unknown source IDs', () => {
    const names = TestBed.inject(SourceBookNamesService);
    names.setRevision(importedRevision());
    expect(names.fullName('mybrew')).toBe('My Homebrew Collection');
    expect(names.fullName('XUATEST')).toBe('Unearthed Arcana: Test Options');
    expect(names.fullName('XMM')).toBe('Monster Manual (2025)');
    const fixture = TestBed.createComponent(SourceBookOptionComponent);
    fixture.componentRef.setInput('book', 'UNKNOWN'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('UNKNOWN');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    names.setRevision(undefined);
    expect(names.fullName('MYBREW')).toBe('');
    expect(names.fullName('XPHB')).toBe("Player's Handbook (2024)");
  });

  it('searches full titles in the compendium while emitting source IDs for selection', async () => {
    const names = TestBed.inject(SourceBookNamesService);
    vi.spyOn(names, 'refresh').mockResolvedValue(undefined);
    names.setRevision(importedRevision());
    const fixture = TestBed.createComponent(CompendiumSourceFilterComponent);
    fixture.componentRef.setInput('books', ['XPHB', 'MYBREW', 'XUATEST']);
    fixture.componentRef.setInput('selected', []);
    fixture.componentRef.setInput('defaults', []);
    const changed = vi.fn(); fixture.componentInstance.selectedChange.subscribe(changed);
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.query.set('Unearthed Arcana'); fixture.detectChanges();
    expect(fixture.componentInstance.visibleBooks()).toEqual(['XUATEST']);
    const option = fixture.nativeElement.querySelector('app-source-book-option') as HTMLElement;
    option.querySelector('button')!.click(); fixture.detectChanges();
    expect(option.textContent).toContain('Unearthed Arcana: Test Options');
    expect(changed).not.toHaveBeenCalled();
    option.querySelector('input')!.click();
    expect(changed).toHaveBeenCalledExactlyOnceWith(['XUATEST']);
    fixture.componentInstance.query.set('handbook'); fixture.detectChanges();
    expect(fixture.componentInstance.visibleBooks()).toEqual(['XPHB']);
  });
});
