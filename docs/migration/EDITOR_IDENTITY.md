# Character entry identity

Creator-managed feature sources, features, spells and species use `editorId`.
It identifies an instance on this character. Manual entries use random UUIDs;
wizard entries use `hash:` followed by a deterministic version-8 UUID derived
from a structured seed. The shared helper lives in `editor/editor-identity.ts`.
The hash is an identity mechanism, not a security primitive.

For example, `editorId: "hash:…"` visibly identifies a deterministic hash ID,
while `editorId: "…"` with an ordinary version-4 UUID identifies a random ID.

Wizard IDs remain stable between previews, restarts and library updates. Spell
IDs include the casting source and list, because Known and Prepared entries are
different instances. Class selection IDs distinguish repeated selections.

`contentReference` identifies the imported definition and its provenance:
content key, library identity, revision and commit. It uses a shared
`ContentReference` model. It cannot replace `editorId`: multiple instances can
refer to the same definition, and custom entries have no imported definition.
The old wizard IDs duplicated this provenance in large JSON strings; compact
instance IDs eliminate that duplicated text without losing either meaning.

RAW app/viewer JSON imports receive missing editor identities at the shared library
boundary. Current entry IDs are preserved. Earlier experimental wizard IDs and
source-ID field names are not converted. The operation is idempotent and does not
mutate its input. Unrelated database, revision, note and upstream entity IDs retain
their own meaning.

Wizard bookkeeping is also readable JSON. `baseline` is an array of entries with
`path`, `scope`, `label` and `fingerprint`, rather than a map keyed by escaped JSON:

```json
{
  "baseline": [
    {
      "path": ["spells", "hash:…"],
      "scope": "spells",
      "label": "Shield",
      "value": { "editorId": "hash:…", "name": "Shield" }
    }
  ],
  "protectedPaths": [["character", "maxHp"]]
}
```

The baseline contains no copied entity snapshots. Fixed-size FNV-1a 128
fingerprints detect changes with sorted object keys and session counters excluded.
For features, spells and species, an optional `editFingerprint` additionally
excludes notes and trackers: those are preserved independently during updates.
The full fingerprint determines whether an obsolete entry is still untouched.

RAW app/viewer JSON needs no wizard history. Earlier experimental ID formats,
full-value baselines and escaped-key history are not supported. Current history
must contain fingerprints; retired formats are rejected rather than converted. Lookup keys may still be strings
inside the merge algorithm, but are not part of exported JSON.

The shared helpers in `wizard-fingerprint.ts` define the comparison rules.
`stable-hash.ts` supplies the same FNV-1a primitive used for wizard IDs. A
fingerprint describes the prior value; an editor ID identifies the entry.


Both the creator and playing sheet use `copySpellToList` when creating another
list instance. A copy gets a fresh instance ID but retains the same content
reference and a detached copy of notes, trackers and entity data.

Wizard history is optional bookkeeping. Its format is validated when the wizard
runs, not while listing, viewing or editing the underlying character sheet.
Unsupported history must never hide other saved characters or prevent play.
