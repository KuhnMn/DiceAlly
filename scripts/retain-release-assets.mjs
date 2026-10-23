import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestName = 'release-assets.json';
const assetPattern = /^(?:chunk|main|worker|styles)-[A-Z0-9]+\.(?:js|css)$/;

/** Keep two previous sets of hashed code assets for tabs opened before a deployment. HTML/config always stay current. */
export function retainReleaseAssets(directory, previousFiles, readPrevious) {
  if (directory instanceof URL) directory = fileURLToPath(directory);
  const current = readdirSync(directory).filter(file => assetPattern.test(file)).sort();
  let history;
  if (previousFiles.includes(manifestName)) {
    const manifest = JSON.parse(readPrevious(manifestName).toString('utf8'));
    if (!Array.isArray(manifest.current) || !Array.isArray(manifest.previous)) throw new Error('Invalid deployed asset manifest.');
    history = [manifest.current, ...manifest.previous].slice(0, 2);
  } else {
    // The first deployment with retention can adopt an existing release without a manifest.
    history = [previousFiles.filter(file => assetPattern.test(file))];
  }
  for (const release of history) {
    if (!Array.isArray(release) || release.some(file => typeof file !== 'string' || !assetPattern.test(file) || !previousFiles.includes(file))) {
      throw new Error('Invalid retained asset path.');
    }
    for (const file of release) {
      if (!current.includes(file)) writeFileSync(path.join(directory, file), readPrevious(file));
    }
  }
  writeFileSync(path.join(directory, manifestName), JSON.stringify({ current, previous: history }) + '\n');
  return new Set(history.flat().filter(file => !current.includes(file))).size;
}
