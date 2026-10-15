import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { APP_RUNTIME_CONFIG, appRuntimeConfig } from './app.tokens';
import { CHARACTER_REPOSITORY } from './characters/character-repository';
import { AccountCharacterRepository } from './characters/account-character-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    { provide: APP_RUNTIME_CONFIG, useValue: appRuntimeConfig },
    { provide: CHARACTER_REPOSITORY, useExisting: AccountCharacterRepository },
  ]
};
