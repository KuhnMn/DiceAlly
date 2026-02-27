import type { Routes } from '@angular/router';
import { ImportComponent } from './import/import.component';
import { CharacterSheetComponent } from './sheet/character-sheet.component';
import { canDeactivateCharacterSheet } from './guards/unsaved-changes.guard';

export const routes: Routes = [
	{ path: '', component: ImportComponent },
	{ path: 'sheet', component: CharacterSheetComponent, canDeactivate: [canDeactivateCharacterSheet] },
];
