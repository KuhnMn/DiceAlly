import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { AccountService } from './account.service';
import { AUTH_CLIENT_LOADER } from './auth-client-loader';
import { APP_RUNTIME_CONFIG } from '../app.tokens';

const loadClient = vi.fn();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); loadClient.mockReset(); });

const config = { apiKey: 'test', authDomain: 'test.invalid', projectId: 'test', databaseURL: 'https://test.invalid', appId: 'test' };
function setup() {
  // The unit-test runner also exercises server-safe services without a browser window.
  if (typeof window === 'undefined') vi.stubGlobal('window', {});
  TestBed.configureTestingModule({ providers: [{ provide: APP_RUNTIME_CONFIG, useValue: { firebase: config } }, { provide: AUTH_CLIENT_LOADER, useValue: loadClient }] });
  return TestBed.inject(AccountService);
}

describe('Deferred authentication startup', () => {
  it('keeps account guards waiting until the persisted user and approval are restored', async () => {
    const user = { uid: 'member', getIdToken: async () => 'token' };
    let observed!: (value: typeof user) => Promise<void>;
    loadClient.mockReturnValue({ observe: (callback: typeof observed) => { observed = callback; } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => true }));
    const service = setup();
    let ready = false;
    void service.ready.then(() => ready = true);
    await vi.waitFor(() => expect(observed).toBeDefined());
    expect(ready).toBe(false);
    expect(service.loading()).toBe(true);
    await observed(user);
    await service.ready;
    expect(service.accessible()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(loadClient).toHaveBeenCalledWith(config);
  });

  it('settles startup and exposes recovery when the authentication client cannot initialize', async () => {
    loadClient.mockImplementation(() => { throw new Error('SDK unavailable'); });
    const service = setup();
    await service.ready;
    expect(service.initializationFailed()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(service.accessible()).toBe(false);
    await expect(service.signIn('user@example.test', 'password')).rejects.toThrow('Check your connection');
  });
});
