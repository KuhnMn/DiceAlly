/** Browser messages vary between Chromium, Firefox and Safari. Do not retry application errors. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|loading (?:css )?chunk [\w-]+ failed|unable to preload css/i.test(message);
}

function retryUrl(error: unknown): string | undefined {
  if (typeof location === 'undefined') return;
  const message = error instanceof Error ? error.message : String(error);
  const address = message.match(/https?:\/\/[^\s"'<>]+\.m?js(?:\?[^\s"'<>]*)?/i)?.[0];
  if (!address) return;
  const url = new URL(address);
  if (url.origin !== location.origin) return;
  url.searchParams.set('module-retry', String(Date.now()));
  return url.href;
}

/**
 * One bounded retry for temporary download failures. Browsers may cache a failed import in their
 * module map, so retry the entry URL once with a fresh query. Static dependencies keep their
 * identities: duplicating the Angular runtime would break DI. A failed dependency or an obsolete
 * release can still require the explicit Reload action; never refresh an open editor automatically.
 */
export async function loadWithRetry<T>(load: () => Promise<T>, expectedExport?: keyof T & string): Promise<T> {
  try { return await load(); }
  catch (error) {
    if (!isModuleLoadError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    const url = expectedExport ? retryUrl(error) : undefined;
    if (!url) return load();
    const module = await import(/* @vite-ignore */ url) as T;
    // Some browsers report a failing transitive dependency's URL, not the requested entry module.
    if (!module || !(expectedExport! in Object(module))) throw error;
    return module;
  }
}
