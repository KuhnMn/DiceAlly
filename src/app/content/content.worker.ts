import { IndexedDbContentCache } from './content-cache';
import { ContentImportError, importContent } from './content-importer';
import { ContentImportRequest } from './content-import-request';
import { fetchContent } from './github-source';
import { importHomebrew } from './homebrew-importer';
import { MAX_HOMEBREW_BYTES, readHomebrewFile } from './homebrew-package';
import { ImportProgress } from './content.model';
import { ContentSchemaError } from './content-schema';

let controller: AbortController | undefined;
addEventListener('message', async ({ data }: MessageEvent<ContentImportRequest>) => {
  if (data.action === 'cancel') { controller?.abort(); return; }
  if (controller) return;
  controller = new AbortController();
  try {
    const cache = new IndexedDbContentCache();
    const signal = controller.signal;
    const progress = (progress: ImportProgress) => postMessage({ type: 'progress', progress });
    const revision = await cache.withImport(data.namespace, async () => {
      const base = await cache.active(data.namespace, data.source);
      if (data.action === 'import') return importContent(cache, {
        namespace: data.namespace, source: data.source, signal, progress, homebrewFiles: base?.homebrewFiles,
      });
      if (data.action === 'remove-homebrew') return importHomebrew(cache, {
        namespace: data.namespace, source: data.source, base, removeFileId: data.fileId, bytes: 0, signal, progress,
      });
      let value: unknown;
      let bytes: number;
      let name: string;
      let url: string | undefined;
      if (data.file) {
        if (data.file.size > MAX_HOMEBREW_BYTES) throw new Error('Homebrew files must be 32 MB or smaller.');
        name = data.file.name;
        const text = await data.file.text();
        signal.throwIfAborted();
        value = JSON.parse(text); bytes = data.file.size;
      } else {
        const address = new URL(data.url ?? '');
        if (address.protocol !== 'https:' || address.username || address.password) throw new Error('Enter an HTTPS URL for one JSON file.');
        name = decodeURIComponent(address.pathname.split('/').at(-1) ?? '');
        if (!name.toLowerCase().endsWith('.json')) throw new Error('The URL must point to a single .json file.');
        url = address.href;
        const downloaded = await fetchContent(url, signal);
        value = downloaded.value; bytes = downloaded.bytes;
        if (bytes > MAX_HOMEBREW_BYTES) throw new Error('Homebrew files must be 32 MB or smaller.');
      }
      const file = await readHomebrewFile(value, name, url);
      return importHomebrew(cache, { namespace: data.namespace, source: data.source, base, file, bytes, signal, progress });
    });
    postMessage({ type: 'complete', revision });
  } catch (error) {
    postMessage({ type: 'error', message: controller.signal.aborted ? 'Import cancelled. Previous content retained.' : String(error),
      diagnostics: error instanceof ContentImportError || error instanceof ContentSchemaError ? error.diagnostics : [] });
  } finally { controller = undefined; }
});
