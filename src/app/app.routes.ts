import type { Routes } from '@angular/router';
import { ImportComponent } from './import/import.component';
import { CharacterSheetComponent } from './sheet/character-sheet.component';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';

export const routes: Routes = [
	{ path: '', component: ImportComponent },
	{ path: 'sheet', component: CharacterSheetComponent, canDeactivate: [canDeactivateCharacterSheet] },
	{ path: 'impressum', loadComponent: () => import('./legal/impressum.component').then((m) => m.ImpressumComponent) },
	{ path: 'datenschutz', loadComponent: () => import('./legal/datenschutz.component').then((m) => m.DatenschutzComponent) },
];
