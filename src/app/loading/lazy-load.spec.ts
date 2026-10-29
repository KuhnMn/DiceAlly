import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isModuleLoadError, loadWithRetry } from './lazy-load';
import { canPreload } from './idle-preloading.strategy';

beforeEach(() => vi.stubGlobal('navigator', { onLine: true }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Lazy module loading', () => {
  it.each(['Failed to fetch dynamically imported module: /chunk-X.js', 'error loading dynamically imported module', 'Importing a module script failed.'])('recognizes browser download failures: %s', message => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });
  it('retries a temporary download once and returns the recovered module', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module')).mockResolvedValue({ page: true });
    const pending = loadWithRetry(load);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toEqual({ page: true });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('stops after the second download failure', async () => {
    vi.useFakeTimers();
    const error = new TypeError('Importing a module script failed.');
    const load = vi.fn().mockRejectedValue(error);
    const pending = expect(loadWithRetry(load)).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(500);
    await pending;
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('does not repeat module evaluation or application failures', async () => {
    const error = new Error('Invalid character data');
    const load = vi.fn().mockRejectedValue(error);
    await expect(loadWithRetry(load)).rejects.toBe(error);
    expect(load).toHaveBeenCalledOnce();
  });
  it('does not speculate on slow, metered or offline connections', () => {
    for (const effectiveType of ['slow-2g', '2g', '3g']) expect(canPreload({ effectiveType }, true)).toBe(false);
    expect(canPreload({ saveData: true, effectiveType: '4g' }, true)).toBe(false);
    expect(canPreload(undefined, false)).toBe(false);
    expect(canPreload({ effectiveType: '4g' }, true)).toBe(true);
    expect(canPreload(undefined, true)).toBe(true);
  });
});
