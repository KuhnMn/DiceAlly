import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { IdlePreloadingStrategy } from './idle-preloading.strategy';
import { AccountService } from '../auth/account.service';

afterEach(() => vi.useRealTimers());

describe('Background screen preloading', () => {
  it('only warms opted-in screens for approved accounts and ignores speculative failures', async () => {
    vi.useFakeTimers();
    let approved = false;
    TestBed.configureTestingModule({ providers: [{ provide: AccountService, useValue: { accessible: () => approved } }] });
    const strategy = TestBed.inject(IdlePreloadingStrategy);
    const load = vi.fn(() => of('module'));
    await firstValueFrom(strategy.preload({ data: { preload: true } }, load), { defaultValue: null });
    approved = true;
    await firstValueFrom(strategy.preload({}, load), { defaultValue: null });
    expect(load).not.toHaveBeenCalled();
    const pending = firstValueFrom(strategy.preload({ data: { preload: true } }, load));
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2500);
    expect(await pending).toBe('module');
    const failure = firstValueFrom(strategy.preload({ data: { preload: true } }, () => throwError(() => new Error('offline'))), { defaultValue: null });
    await vi.advanceTimersByTimeAsync(2500);
    expect(await failure).toBeNull();
  });
});
