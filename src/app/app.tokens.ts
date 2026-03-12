import { InjectionToken } from '@angular/core';

export interface AppRuntimeConfig {
  tmpfilesProxyUrl: string;
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG');

export const appRuntimeConfig: AppRuntimeConfig = {
  tmpfilesProxyUrl: 'https://REPLACE_WITH_YOUR_WORKER.workers.dev',
};