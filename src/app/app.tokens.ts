import { InjectionToken } from '@angular/core';

export interface AppRuntimeConfig {
  tmpfilesProxyUrl: string;
  tmpfilesProxyAuthToken: string;
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG');

const defaultAppRuntimeConfig: AppRuntimeConfig = {
  tmpfilesProxyUrl: 'https://REPLACE_WITH_YOUR_WORKER.workers.dev',
  tmpfilesProxyAuthToken: 'REPLACE_WITH_YOUR_AUTH_TOKEN',
};

type RuntimeConfigGlobal = typeof globalThis & {
  __ALLY_APP_CONFIG__?: Partial<AppRuntimeConfig>;
};

export const appRuntimeConfig: AppRuntimeConfig = {
  ...defaultAppRuntimeConfig,
  ...((globalThis as RuntimeConfigGlobal).__ALLY_APP_CONFIG__ ?? {}),
};