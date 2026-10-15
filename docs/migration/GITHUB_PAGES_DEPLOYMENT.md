# Deploy Dice Ally separately

The new site publishes to `KuhnMn/DiceAlly`, branch `gh-pages`, with custom domain
`diceally.pages.mxkuhn.de`. It never defaults to this checkout's `origin` remote.
The existing `KuhnMn/AllySheetViewer` Pages site and its DNS settings are not changed.

## One-time setup

1. Create the public GitHub repository `KuhnMn/DiceAlly`.
2. Configure `.env` using `.env.example`, including `APP_SITE_URL=https://diceally.pages.mxkuhn.de`.
3. After the first deployment, set that repository's Settings → Pages to publish the
   root of `gh-pages`. Set its custom domain and enable HTTPS once DNS is ready.
4. Add a DNS CNAME for `diceally.pages` in the `mxkuhn.de` zone pointing to
   `kuhnmn.github.io`. Keep the old site's DNS record unchanged.
5. Add `diceally.pages.mxkuhn.de` to Firebase Authentication's authorized domains.
   Publish the latest database rules separately in the Firebase Console.

## Commands

`npm run deploy:prepare` generates public Firebase configuration, builds production assets,
and prepares `dist/dice-ally-pages/browser` without pushing anything.

`npm run deploy -- --dry-run` prepares the build and previews publishing without pushing.

`npm run deploy` performs the full preparation and publishes only the new site's build.
Use this command for subsequent releases. GitHub authentication and push permission to
`KuhnMn/DiceAlly` are required; no credentials are stored in the script.

`npx ng deploy` is also explicitly targeted at DiceAlly, but it only publishes the already
prepared build. Run `npm run deploy:prepare` first; prefer `npm run deploy` to avoid stale assets.

Deployment builds use `/` as the base URL. The script fixes the new build's 404 redirect
and creates CNAME/.nojekyll files. The public redirect targets the custom domain root too. This lets
direct character/editor links recover correctly on the custom domain.

The build contains public Firebase web configuration, but not `.env` or admin credentials.
The generated files are in ignored dist output. No deployment is performed merely by
adding these scripts or running the prepare command.
