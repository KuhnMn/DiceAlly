# 5etools schema snapshot

These full compiled schemas come from the `5etools-utils` project by Giddy:
https://github.com/TheGiddyLimit/5etools-utils

The upstream package declares the MIT license. `manifest.json` records the exact
repository commit, package version, individual schema versions, and SHA-256 hashes.
Schema files are retained verbatim. No game content corpus is included here.

Update deliberately with `npm run schemas:snapshot -- <5etools-utils checkout>`,
review the schema changes and coverage inventory, then run `npm run schemas:generate`.
Normal builds use only this snapshot. Imports never download schemas.

The brew entry schema also references `plutonium-scenes/test/schema/shared.json`
by TheGiddyLimit. That external dependency is stored under `brew/external` with
its original reference URL, exact download URL/commit, and checksum in the
manifest. It is attributed to https://github.com/TheGiddyLimit/plutonium-scenes;
the MIT notice below describes the `5etools-utils` package.

MIT License

Copyright (c) Giddy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
