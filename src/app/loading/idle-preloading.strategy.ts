import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, catchError, mergeMap, timer } from 'rxjs';
import { AccountService } from '../auth/account.service';

interface Connection { saveData?: boolean; effectiveType?: string; }
export function canPreload(connection: Connection | undefined, online: boolean): boolean {
  return online && !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '');
}

/** Warm frequently visited screens after navigation; never download import/validator/editor code speculatively. */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  private readonly account = inject(AccountService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this.browser || !route.data?.['preload'] || !this.account.accessible()) return EMPTY;
    return timer(2500).pipe(mergeMap(() => {
      const connection = (navigator as Navigator & { connection?: Connection }).connection;
      return this.account.accessible() && canPreload(connection, navigator.onLine) ? load() : EMPTY;
    }), catchError(() => EMPTY));
  }
}
