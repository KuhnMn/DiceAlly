import { IndexedDbContentCache } from './content-cache';
import { ContentImportError, importContent } from './content-importer';
import { ContentImportRequest } from './content-import-request';
import { downloadHomebrewUpdate, downloadHomebrewUrl } from './homebrew-updates';
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
    if (data.action === 'check-homebrew') {
      const base = await cache.active(data.namespace, data.source);
      const result = await downloadHomebrewUpdate(base, data.fileId, signal);
      postMessage({ type: 'homebrew-checked', fileId: data.fileId, state: result.state });
      return;
    }
    const revision = await cache.withImport(data.namespace, async () => {
      const base = await cache.active(data.namespace, data.source);
      if (data.action === 'import') return importContent(cache, {
        namespace: data.namespace, source: data.source, signal, progress, homebrewFiles: base?.homebrewFiles,
      });
      if (data.action === 'remove-homebrew') return importHomebrew(cache, {
        namespace: data.namespace, source: data.source, base, removeFileId: data.fileId, bytes: 0, signal, progress,
      });
      if (data.action === 'update-homebrew') {
        const { file, bytes } = await downloadHomebrewUpdate(base, data.fileId, signal);
        return importHomebrew(cache, { namespace: data.namespace, source: data.source, base, file, bytes, signal, progress });
      }
      let value: unknown;
      let bytes: number;
      let name: string;
      if (data.file) {
        if (data.file.size > MAX_HOMEBREW_BYTES) throw new Error('Homebrew files must be 32 MB or smaller.');
        name = data.file.name;
        const text = await data.file.text();
        signal.throwIfAborted();
        value = JSON.parse(text); bytes = data.file.size;
      } else {
        const { file, bytes } = await downloadHomebrewUrl(data.url ?? '', signal);
        return importHomebrew(cache, { namespace: data.namespace, source: data.source, base, file, bytes, signal, progress });
      }
      const file = await readHomebrewFile(value, name);
      return importHomebrew(cache, { namespace: data.namespace, source: data.source, base, file, bytes, signal, progress });
    });
    postMessage({ type: 'complete', revision });
  } catch (error) {
    postMessage({ type: 'error', message: controller.signal.aborted ? (data.action === 'check-homebrew' ? 'Update check cancelled. Installed content retained.' : 'Import cancelled. Previous content retained.') : String(error),
      diagnostics: error instanceof ContentImportError || error instanceof ContentSchemaError ? error.diagnostics : [] });
  } finally { controller = undefined; }
});
