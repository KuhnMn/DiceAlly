import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ImportComponent } from './import.component';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterSharingService } from '../characters/character-sharing.service';

describe('Old-export import controls', () => {
  it('keeps normal import separate and retains conversion mode when overriding a conflict', async () => {
    const conflict = { success: false, error: { code: 'IMPORT_CONFLICT', message: 'Already imported' } };
    const library = { changed: signal(0), error: signal(''), migrationIssues: signal([]), storageBytes: signal(0),
      summaries: vi.fn().mockResolvedValue([]), importCharacterFromJson: vi.fn().mockResolvedValue(conflict),
      importLegacyCharacterFromJson: vi.fn().mockResolvedValue(conflict) };
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: CharacterLibraryService, useValue: library }, { provide: CharacterSharingService, useValue: {} }] });
    const fixture = TestBed.createComponent(ImportComponent);
    const component = fixture.componentInstance;
    component.raw = '{"character":{"name":"Legacy"}}';
    await component.loadFromText();
    expect(library.importCharacterFromJson).toHaveBeenCalledOnce();
    expect(library.importLegacyCharacterFromJson).not.toHaveBeenCalled();
    await component.loadFromText(true);
    expect(component.pendingImport()?.legacy).toBe(true);
    await component.confirmOverride();
    expect(library.importLegacyCharacterFromJson).toHaveBeenLastCalledWith(component.raw, true);
    expect(library.importCharacterFromJson).toHaveBeenCalledOnce();
    expect(component.isConvertingLegacy()).toBe(false);
  });
});
