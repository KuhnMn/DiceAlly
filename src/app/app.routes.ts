import type { Routes } from '@angular/router';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';
import { openCharacterSheet, resolveEditorCharacter } from './characters/character-route';
import { requireApprovedAccount } from './auth/account.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent) },
  { path: '', canActivateChild: [requireApprovedAccount], children: [
    { path: 'characters/new', loadComponent: () => import('./editor/local-editor.component').then(m => m.LocalEditorComponent),
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
    { path: 'characters/:id/edit', loadComponent: () => import('./editor/local-editor.component').then(m => m.LocalEditorComponent),
      resolve: { editorCharacter: resolveEditorCharacter },
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
  { path: 'content', loadComponent: () => import('./content/content-import.component').then(m => m.ContentImportComponent) },
	{ path: '', loadComponent: () => import('./import/import.component').then(m => m.ImportComponent) },
  { path: 'characters/:id', loadComponent: () => import('./sheet/character-sheet.component').then(m => m.CharacterSheetComponent), canActivate: [openCharacterSheet], canDeactivate: [canDeactivateCharacterSheet] },
  { path: 'sheet', loadComponent: () => import('./sheet/character-sheet.component').then(m => m.CharacterSheetComponent), canDeactivate: [canDeactivateCharacterSheet] },
  ] },
	{ path: 'impressum', loadComponent: () => import('./legal/impressum.component').then((m) => m.ImpressumComponent) },
	{ path: 'datenschutz', loadComponent: () => import('./legal/datenschutz.component').then((m) => m.DatenschutzComponent) },
];
