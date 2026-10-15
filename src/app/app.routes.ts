import type { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { ImportComponent } from './import/import.component';
import { CharacterSheetComponent } from './sheet/character-sheet.component';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';
import { openCharacterSheet, resolveEditorCharacter } from './characters/character-route';

export const routes: Routes = [
  ...(isDevMode() ? [
    { path: 'characters/new', loadComponent: () => import('./editor/local-editor.component').then(m => m.LocalEditorComponent),
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
    { path: 'characters/:id/edit', loadComponent: () => import('./editor/local-editor.component').then(m => m.LocalEditorComponent),
      resolve: { editorCharacter: resolveEditorCharacter },
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
  ] : []),
  ...(isDevMode() ? [{ path: 'content', loadComponent: () => import('./content/content-import.component').then(m => m.ContentImportComponent) }] : []),
	{ path: '', component: ImportComponent },
  { path: 'characters/:id', component: CharacterSheetComponent, canActivate: [openCharacterSheet], canDeactivate: [canDeactivateCharacterSheet] },
	{ path: 'sheet', component: CharacterSheetComponent, canDeactivate: [canDeactivateCharacterSheet] },
	{ path: 'impressum', loadComponent: () => import('./legal/impressum.component').then((m) => m.ImpressumComponent) },
	{ path: 'datenschutz', loadComponent: () => import('./legal/datenschutz.component').then((m) => m.DatenschutzComponent) },
];
