import { ContentSource, JsonObject, object, string, validateSource } from './content.model';

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
export const ROOT_FILES = [
  'feats.json', 'conditionsdiseases.json', 'items-base.json', 'optionalfeatures.json',
  'races.json', 'backgrounds.json', 'variantrules.json', 'tables.json', 'items.json', 'magicvariants.json',
  'generated/gendata-variantrules.json', 'generated/gendata-tables.json', 'spells/sources.json',
];
export async function discoverFiles(source: ContentSource, commit: string, fetcher = fetchContent, signal?: AbortSignal): Promise<{ files: string[]; bytes: number }> {
  const files = new Set(ROOT_FILES);
  let bytes = 0;
  // Keep discovery bounded; each category index is tiny and does not require the Git trees API.
  for (const category of ['class', 'spells', 'bestiary']) {
    const result = await fetcher(rawUrl(source, commit, `${category}/index.json`), signal);
    bytes += result.bytes;
    const index: JsonObject | undefined = object(result.value);
    if (!index || !Object.keys(index).length) throw new Error(`Missing or invalid ${category}/index.json.`);
    for (const file of Object.values(index)) {
      if (typeof file !== 'string' || file.includes('/') || !file.endsWith('.json')) {
        throw new Error(`Invalid file in ${category}/index.json.`);
      }
      rawUrl(source, commit, `${category}/${file}`);
      files.add(`${category}/${file}`);
    }
  }
  return { files: [...files], bytes };
}
