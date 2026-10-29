import { HomebrewFile, ImportRevision } from './content.model';
import { FetchContent, fetchContent } from './github-source';
import { MAX_HOMEBREW_BYTES, readHomebrewFile } from './homebrew-package';

export type HomebrewUpdateState = 'current' | 'available';

/** Share URL validation, fresh downloads and schema validation between import, update and check. */
export async function downloadHomebrewUrl(url: string, signal?: AbortSignal,
  fetcher: FetchContent = (address, abort) => fetchContent(address, abort, 'no-cache')) {
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.username || address.password) throw new Error('Enter an HTTPS URL for one JSON file.');
  const name = decodeURIComponent(address.pathname.split('/').at(-1) ?? '');
  if (!name.toLowerCase().endsWith('.json')) throw new Error('The URL must point to a single .json file.');
  const downloaded = await fetcher(address.href, signal);
  signal?.throwIfAborted();
  if (downloaded.bytes > MAX_HOMEBREW_BYTES) throw new Error('Homebrew files must be 32 MB or smaller.');
  const file = await readHomebrewFile(downloaded.value, name, address.href);
  signal?.throwIfAborted();
  return { file, bytes: downloaded.bytes };
}

/** The installed ID is authoritative, including for older normalized URL identities. */
export async function downloadHomebrewUpdate(base: ImportRevision | undefined, fileId: string,
  signal?: AbortSignal, fetcher?: FetchContent): Promise<{ file: HomebrewFile; bytes: number; state: HomebrewUpdateState }> {
  const installed = base?.homebrewFiles?.find(file => file.id === fileId);
  if (!installed) throw new Error('That homebrew file is no longer installed.');
  if (!installed.url) throw new Error('This file was uploaded from your device. Select the JSON file again to update it.');
  const downloaded = await downloadHomebrewUrl(installed.url, signal, fetcher);
  return { ...downloaded, file: { ...downloaded.file, id: installed.id },
    state: downloaded.file.digest === installed.digest ? 'current' : 'available' };
}
