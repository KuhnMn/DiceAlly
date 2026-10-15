import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from './account.service';
import { CharacterSyncService } from '../characters/sync/character-sync.service';

export const requireApprovedAccount: CanActivateFn = async () => {
  const account = inject(AccountService);
  const router = inject(Router);
  const sync = inject(CharacterSyncService);
  await account.ready;
  if (!account.accessible()) return router.createUrlTree(['/login']);
  await sync.ensureInitialSync();
  return account.accessible() || router.createUrlTree(['/login']);
};
