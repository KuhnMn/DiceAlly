import { loadWithRetry } from './loading/lazy-load';
import type { Routes } from '@angular/router';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';
import { openCharacterSheet, resolveEditorCharacter } from './characters/character-route';
import { requireApprovedAccount } from './auth/account.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => loadWithRetry(() => import('./auth/login.component'), 'LoginComponent').then(m => m.LoginComponent) },
  { path: '', canActivateChild: [requireApprovedAccount], children: [
    { path: 'characters/new', loadComponent: () => loadWithRetry(() => import('./editor/local-editor.component'), 'LocalEditorComponent').then(m => m.LocalEditorComponent),
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
    { path: 'characters/:id/edit', loadComponent: () => loadWithRetry(() => import('./editor/local-editor.component'), 'LocalEditorComponent').then(m => m.LocalEditorComponent),
      resolve: { editorCharacter: resolveEditorCharacter },
      canDeactivate: [(component: { canLeave(): boolean | Promise<boolean> }) => component.canLeave()] },
  { path: 'content', loadComponent: () => loadWithRetry(() => import('./content/content-import.component'), 'ContentImportComponent').then(m => m.ContentImportComponent) },
  { path: 'compendium', data: { preload: true }, loadComponent: () => loadWithRetry(() => import('./compendium/compendium.component'), 'CompendiumComponent').then(m => m.CompendiumComponent) },
  { path: 'compendium/class', loadComponent: () => loadWithRetry(() => import('./compendium/class-compendium.component'), 'ClassCompendiumComponent').then(m => m.ClassCompendiumComponent) },
  { path: 'compendium/:type', loadComponent: () => loadWithRetry(() => import('./compendium/compendium.component'), 'CompendiumComponent').then(m => m.CompendiumComponent) },
	{ path: '', data: { preload: true }, loadComponent: () => loadWithRetry(() => import('./import/import.component'), 'ImportComponent').then(m => m.ImportComponent) },
  { path: 'characters/:id', loadComponent: () => loadWithRetry(() => import('./sheet/character-sheet.component'), 'CharacterSheetComponent').then(m => m.CharacterSheetComponent), canActivate: [openCharacterSheet], canDeactivate: [canDeactivateCharacterSheet] },
  { path: 'sheet', data: { preload: true }, loadComponent: () => loadWithRetry(() => import('./sheet/character-sheet.component'), 'CharacterSheetComponent').then(m => m.CharacterSheetComponent), canDeactivate: [canDeactivateCharacterSheet] },
  ] },
	{ path: 'impressum', loadComponent: () => loadWithRetry(() => import('./legal/impressum.component'), 'ImpressumComponent').then(m => m.ImpressumComponent) },
	{ path: 'datenschutz', loadComponent: () => loadWithRetry(() => import('./legal/datenschutz.component'), 'DatenschutzComponent').then(m => m.DatenschutzComponent) },
];
