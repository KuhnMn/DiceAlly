export class FirebaseDatabaseError extends Error {
  constructor(readonly status: number) {
    super(status === 401 || status === 403
      ? `Firebase denied the request (HTTP ${status}). Check account approval and publish the latest database rules.`
      : `Cloud request failed (HTTP ${status}). Try again when the service is available.`);
  }
}

/** Authenticated REST operations shared by character sync and share-code links. */
export class FirebaseDatabaseClient {
  constructor(private readonly baseUrl: string, private readonly token: () => Promise<string>,
    private readonly active: () => boolean) {}

  async request(path: string, init?: RequestInit, query: Record<string, string> = {}) {
    if (!this.active()) throw new Error('Account changed. Try again.');
    const token = await this.token();
    if (!this.active()) throw new Error('Account changed. Try again.');
    const params = new URLSearchParams({ auth: token, ...query });
    if (init) params.set('print', 'silent');
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/${path}.json?${params}`, {
      ...init, cache: 'no-store', signal: AbortSignal.timeout(30_000),
    });
    if (!this.active()) throw new Error('Account changed. Try again.');
    if (!response.ok) throw new FirebaseDatabaseError(response.status);
    return response;
  }

  async read(path: string, query?: Record<string, string>): Promise<unknown> {
    return (await this.request(path, undefined, query)).json();
  }

  async update(updates: Record<string, unknown>) {
    await this.request('', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
  }
}
