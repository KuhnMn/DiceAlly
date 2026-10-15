import { InjectionToken } from '@angular/core';

export interface AppRuntimeConfig {
  firebase?: FirebaseWebConfig;
  siteUrl?: string;
}

/** Public browser SDK settings, supplied by the deployment environment. Never put admin credentials here. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseURL: string;
  appId: string;
  messagingSenderId?: string;
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG');

const defaultAppRuntimeConfig: AppRuntimeConfig = {};

type RuntimeConfigGlobal = typeof globalThis & {
  __ALLY_APP_CONFIG__?: Partial<AppRuntimeConfig>;
};

export const appRuntimeConfig: AppRuntimeConfig = {
  ...defaultAppRuntimeConfig,
  ...((globalThis as RuntimeConfigGlobal).__ALLY_APP_CONFIG__ ?? {}),
};
