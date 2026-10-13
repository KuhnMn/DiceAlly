import { IndexedDbContentCache } from './content-cache';
import { ContentImportError, importContent } from './content-importer';
import { ContentSource } from './content.model';

let controller: AbortController | undefined;
addEventListener('message', async ({ data }: MessageEvent<{ action: 'import' | 'cancel'; namespace: string; source: ContentSource }>) => {
  if (data.action === 'cancel') { controller?.abort(); return; }
  if (controller) return;
  controller = new AbortController();
  try {
    const cache = new IndexedDbContentCache();
    const revision = await cache.withImport(data.namespace, () => importContent(cache, {
      namespace: data.namespace, source: data.source, signal: controller.signal,
      progress: progress => postMessage({ type: 'progress', progress }),
    }));
    postMessage({ type: 'complete', revision });
  } catch (error) {
    postMessage({ type: 'error', message: controller.signal.aborted ? 'Import cancelled. Previous content retained.' : String(error),
      diagnostics: error instanceof ContentImportError ? error.diagnostics : [] });
  } finally { controller = undefined; }
});
