import type { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { ImportComponent } from './import/import.component';
import { CharacterSheetComponent } from './sheet/character-sheet.component';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  ...(isDevMode() ? [{ path: 'dev/characters', loadComponent: () => import('./editor/local-editor.component').then(m => m.LocalEditorComponent),
    canDeactivate: [(component: { canLeave(): boolean }) => component.canLeave()] }] : []),
  ...(isDevMode() ? [{ path: 'dev/content', loadComponent: () => import('./content/content-import.component').then(m => m.ContentImportComponent) }] : []),
	{ path: '', component: ImportComponent },
	{ path: 'sheet', component: CharacterSheetComponent, canDeactivate: [canDeactivateCharacterSheet] },
	{ path: 'impressum', loadComponent: () => import('./legal/impressum.component').then((m) => m.ImpressumComponent) },
	{ path: 'datenschutz', loadComponent: () => import('./legal/datenschutz.component').then((m) => m.DatenschutzComponent) },
];
