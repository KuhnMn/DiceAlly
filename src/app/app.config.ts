import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withNavigationErrorHandler, withPreloading, withRouterConfig } from '@angular/router';
import { NavigationLoadingService } from './loading/navigation-loading.service';
import { IdlePreloadingStrategy } from './loading/idle-preloading.strategy';

import { routes } from './app.routes';
import { APP_RUNTIME_CONFIG, appRuntimeConfig } from './app.tokens';
import { CHARACTER_REPOSITORY } from './characters/character-repository';
import { AccountCharacterRepository } from './characters/account-character-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(IdlePreloadingStrategy),
      withRouterConfig({ resolveNavigationPromiseOnError: true }),
      withNavigationErrorHandler(error => inject(NavigationLoadingService).failed(error))),
    { provide: APP_RUNTIME_CONFIG, useValue: appRuntimeConfig },
    { provide: CHARACTER_REPOSITORY, useExisting: AccountCharacterRepository },
  ]
};
