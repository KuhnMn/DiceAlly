import { ContentSource, object, string, validateSource } from './content.model';

export type FetchContent = (url: string, signal?: AbortSignal) => Promise<{ value: unknown; bytes: number }>;
export const fetchContent: FetchContent = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}. GitHub may be unavailable or rate limited.`);
  }
  const text = await response.text();
  return { value: JSON.parse(text) as unknown, bytes: new TextEncoder().encode(text).byteLength };
};
export async function resolveCommit(source: ContentSource, fetcher = fetchContent, signal?: AbortSignal): Promise<string> {
  validateSource(source);
  const { value } = await fetcher(`https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repository)}/commits/${encodeURIComponent(source.branch)}`, signal);
  const commit = string(object(value)?.['sha']);
  if (!/^[a-f\d]{40}$/i.test(commit)) throw new Error('GitHub did not return an exact commit revision.');
  return commit;
}
export function rawUrl(source: ContentSource, commit: string, file: string): string {
  if (file.split('/').some(p => !p || p === '.' || p === '..') || !file.endsWith('.json')) {
    throw new Error(`Invalid content path: ${file}`);
  }
  return `https://raw.githubusercontent.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repository)}/${commit}/${[...source.directory.split('/'), ...file.split('/')].map(encodeURIComponent).join('/')}`;
}
