import { vi } from 'vitest';
import { downloadHomebrewUpdate, downloadHomebrewUrl } from './homebrew-updates';
import { MAX_HOMEBREW_BYTES, readHomebrewFile } from './homebrew-package';
import { homebrewDocumentFixture } from './content-fixtures.testing';
import { DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';

const url = 'https://example.org/my-brew.json?version=latest';
const document = (name = 'Original') => homebrewDocumentFixture({ feat: [{ name, source: 'BREW', entries: ['A feature.'] }] });
async function installed() {
  const file = await readHomebrewFile(document(), 'my-brew.json', url);
  const base: ImportRevision = { id: crypto.randomUUID(), namespace: 'test', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 1,
    status: 'ready', createdAt: '', files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 }, homebrewFiles: [file] };
  return { file, base };
}

describe('Homebrew URL updates', () => {
  beforeAll(async () => readHomebrewFile(document(), 'warmup.json'), 30000);
  afterEach(() => vi.restoreAllMocks());
  it('checks the saved URL and compares content without mutating the installed revision', async () => {
    const { base, file } = await installed(), before = structuredClone(base);
    const fetcher = vi.fn().mockResolvedValue({ value: document(), bytes: 100 });
    expect((await downloadHomebrewUpdate(base, file.id, undefined, fetcher)).state).toBe('current');
    expect(fetcher).toHaveBeenCalledWith(url, undefined);
    fetcher.mockResolvedValue({ value: document('Replacement'), bytes: 120 });
    const update = await downloadHomebrewUpdate(base, file.id, undefined, fetcher);
    expect(update.state).toBe('available'); expect(update.file.id).toBe(file.id);
    expect(update.file.url).toBe(url); expect(update.file.digest).not.toBe(file.digest);
    expect(base).toEqual(before);
  });
  it('revalidates the browser cache for updates', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(document())));
    await downloadHomebrewUrl(url);
    expect(fetcher).toHaveBeenCalledWith(url, { signal: undefined, cache: 'no-cache' });
  });
  it('retains an installed identity even for older URL normalization', async () => {
    const { base, file } = await installed(); file.id = 'legacy-id';
    const update = await downloadHomebrewUpdate(base, file.id, undefined, async () => ({ value: document('Changed'), bytes: 1 }));
    expect(update.file.id).toBe('legacy-id');
  });
  it('does not fetch removed files, local uploads, or invalid URLs', async () => {
    const { base, file } = await installed(); const fetcher = vi.fn();
    await expect(downloadHomebrewUpdate(base, 'missing', undefined, fetcher)).rejects.toThrow('no longer installed');
    file.url = undefined;
    await expect(downloadHomebrewUpdate(base, file.id, undefined, fetcher)).rejects.toThrow('uploaded from your device');
    for (const address of ['http://example.org/a.json', 'https://user:pass@example.org/a.json', 'https://example.org/a.txt']) {
      await expect(downloadHomebrewUrl(address, undefined, fetcher)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports download, size and validation failures without changing installed contents', async () => {
    const { base, file } = await installed(), before = structuredClone(base);
    await expect(downloadHomebrewUpdate(base, file.id, undefined, async () => { throw new Error('Offline'); })).rejects.toThrow('Offline');
    await expect(downloadHomebrewUpdate(base, file.id, undefined, async () => ({ value: document(), bytes: MAX_HOMEBREW_BYTES + 1 }))).rejects.toThrow('32 MB');
    await expect(downloadHomebrewUpdate(base, file.id, undefined, async () => ({ value: { feat: [{ name: 42 }] }, bytes: 1 }))).rejects.toThrow();
    expect(base).toEqual(before);
  });
  it('honors cancellation before accepting downloaded content', async () => {
    const abort = new AbortController();
    await expect(downloadHomebrewUrl(url, abort.signal, async () => {
      abort.abort(); return { value: document(), bytes: 1 };
    })).rejects.toThrow();
  });
});
