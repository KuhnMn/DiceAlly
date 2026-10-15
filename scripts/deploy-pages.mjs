import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'https://github.com/KuhnMn/DiceAlly.git';
const domain = 'diceally.pages.mxkuhn.de';
const output = 'dist/dice-ally-pages/browser';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--prepare-only' && arg !== '--dry-run')) {
  throw new Error('Supported options: --prepare-only, --dry-run. Deployment targets are fixed to protect the original site.');
}
function run(script, arguments_ = []) {
  const result = spawnSync(process.execPath, [script, ...arguments_], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('scripts/generate-runtime-config.mjs');
const context = { window: {} };
runInNewContext(readFileSync(new URL('../public/runtime-config.js', import.meta.url), 'utf8'), context, { timeout: 1000 });
const config = context.window.__ALLY_APP_CONFIG__;
if (!config?.firebase?.apiKey || !config.firebase.databaseURL) throw new Error('Firebase must be configured in .env or the build environment before deployment.');
if (config.siteUrl !== `https://${domain}` && config.siteUrl !== `https://${domain}/`) {
  throw new Error(`Set APP_SITE_URL=https://${domain} before preparing this deployment.`);
}

run('node_modules/@angular/cli/bin/ng.js', ['build', '--configuration=production', '--base-href=/', '--output-path=dist/dice-ally-pages']);
// Keep the original site's source redirect unchanged. Only the dedicated new-site artifact uses /.
const redirect = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8').replaceAll('/AllySheetViewer', '');
writeFileSync(new URL(`../${output}/404.html`, import.meta.url), redirect);
writeFileSync(new URL(`../${output}/CNAME`, import.meta.url), `${domain}\n`);
writeFileSync(new URL(`../${output}/.nojekyll`, import.meta.url), '');
console.log(`Prepared ${output} for https://${domain}. Target: ${target}, branch gh-pages.`);
if (args.includes('--prepare-only')) {
  console.log('Preparation only: nothing was pushed.');
} else {
  run('node_modules/angular-cli-ghpages/angular-cli-ghpages', [
    `--dir=${output}`, `--repo=${target}`, '--branch=gh-pages', `--cname=${domain}`, '--no-notfound',
    ...(args.includes('--dry-run') ? ['--dry-run'] : []),
  ]);
}
