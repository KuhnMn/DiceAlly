import { InjectionToken } from '@angular/core';
import type { FirebaseWebConfig } from '../app.tokens';
import type { FirebaseAuthClient } from './firebase-auth';
import { loadWithRetry } from '../loading/lazy-load';

export const AUTH_CLIENT_LOADER = new InjectionToken<(config: FirebaseWebConfig) => Promise<FirebaseAuthClient>>('AUTH_CLIENT_LOADER', {
  providedIn: 'root',
  factory: () => async config => {
    const { createAuthClient } = await loadWithRetry(() => import('./firebase-auth'), 'createAuthClient');
    return createAuthClient(config);
  },
});
