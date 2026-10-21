import { ContentSource } from './content.model';
import { FetchContent, fetchContent, rawUrl } from './github-source';
import { validateCoreDocument } from './content-schema';

export const ROOT_FILES = [
  'feats.json', 'conditionsdiseases.json', 'items-base.json', 'optionalfeatures.json',
  'races.json', 'backgrounds.json', 'variantrules.json', 'tables.json', 'items.json', 'magicvariants.json',
  'generated/gendata-variantrules.json', 'generated/gendata-tables.json', 'spells/sources.json',
  'actions.json', 'bastions.json', 'objects.json', 'senses.json', 'skills.json', 'vehicles.json',
];

/** Worker-side discovery; ordinary revision checks do not load source validators. */
export async function discoverFiles(source: ContentSource, commit: string, fetcher: FetchContent = fetchContent, signal?: AbortSignal): Promise<{ files: string[]; bytes: number }> {
  const files = new Set(ROOT_FILES);
  let bytes = 0;
  for (const category of ['class', 'spells', 'bestiary']) {
    const file = `${category}/index.json`;
    const result = await fetcher(rawUrl(source, commit, file), signal);
    bytes += result.bytes;
    await validateCoreDocument(result.value, file);
    // The exact dictionary-of-strings shape is established at the boundary above.
    const index = result.value as Record<string, string>;
    if (!Object.keys(index).length) throw new Error(`Missing or invalid ${file}.`);
    for (const name of Object.values(index)) {
      if (name.includes('/') || !name.endsWith('.json')) throw new Error(`Invalid file in ${file}.`);
      rawUrl(source, commit, `${category}/${name}`);
      files.add(`${category}/${name}`);
    }
  }
  return { files: [...files], bytes };
}
