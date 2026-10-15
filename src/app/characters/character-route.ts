import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { CharacterLibraryService } from './character-library.service';
import { CharacterSessionService } from './character-session.service';
import { CharacterRecord } from './character-repository';

export const openCharacterSheet: CanActivateFn = async route => {
  const session = inject(CharacterSessionService);
  const library = inject(CharacterLibraryService);
  const router = inject(Router);
  try { await session.open(route.paramMap.get('id')!); return true; }
  catch (error) { library.error.set(String(error)); return router.parseUrl('/'); }
};

export const resolveEditorCharacter: ResolveFn<CharacterRecord | RedirectCommand> = async route => {
  const library = inject(CharacterLibraryService);
  const router = inject(Router);
  try {
    const record = await library.get(route.paramMap.get('id')!);
    if (!record) throw new Error('Character not found.');
    return record;
  } catch (error) {
    library.error.set(String(error));
    return new RedirectCommand(router.parseUrl('/'));
  }
};
