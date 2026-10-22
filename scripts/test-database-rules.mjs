import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, serverTimestamp } from 'firebase/database';

// Run only against the emulator; no credentials and no production database access.
const environment = await initializeTestEnvironment({
  projectId: 'demo-dice-ally',
  database: { host: '127.0.0.1', port: 9000, rules: readFileSync('firebase/database.rules.json', 'utf8') },
});
try {
  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), 'members'), { alice: true, bob: true });
  });
  const alice = environment.authenticatedContext('alice').database();
  const bob = environment.authenticatedContext('bob').database();
  const stranger = environment.authenticatedContext('stranger').database();
  const anonymous = environment.unauthenticatedContext().database();
  const path = 'users/alice/characters/hero';
  const record = { meta: { revision: 1, hash: 'a'.repeat(64), updatedAt: new Date().toISOString(), deleted: false }, body: '{}' };
  await assertFails(get(ref(anonymous, 'members/alice')));
  await assertSucceeds(get(ref(alice, 'members/alice')));
  await assertFails(get(ref(bob, 'members/alice')));
  await assertFails(set(ref(stranger, 'members/stranger'), true));
  await assertFails(set(ref(stranger, 'users/stranger/characters/hero'), record));
  await assertFails(set(ref(bob, path), record));
  await assertSucceeds(set(ref(alice, path), record));
  await assertFails(get(ref(bob, path)));
  await assertFails(get(ref(anonymous, path)));
  await assertSucceeds(get(ref(alice, path)));
  const preference = { value: '["PHB"]', mutationId: '11111111-1111-4111-8111-111111111111' };
  await assertSucceeds(set(ref(alice, 'users/alice/settings/sourceBooks'), preference));
  await assertFails(get(ref(bob, 'users/alice/settings')));
  await assertFails(set(ref(bob, 'users/alice/settings/sourceBooks'), preference));
  await assertFails(set(ref(stranger, 'users/stranger/settings/sourceBooks'), preference));
  await assertFails(set(ref(alice, 'users/alice/settings/unknown'), preference));
  await assertFails(set(ref(alice, 'users/alice/settings/sourceBooks'), { ...preference, value: 'x'.repeat(32001) }));
  await assertFails(set(ref(alice, 'users/alice/settings/sourceBooks'), { ...preference, extra: 'unexpected' }));
  await assertFails(set(ref(alice, path), record)); // stale revision
  await assertFails(set(ref(alice, path), null)); // deletion must retain a tombstone
  await assertFails(set(ref(alice, path + '/body'), 'changed')); // cannot bypass revision validation
  await assertFails(set(ref(alice, path), { ...record, meta: { ...record.meta, revision: 2, deleted: 'yes' } }));
  await assertFails(set(ref(alice, path), { ...record, meta: { ...record.meta, revision: 2 }, extra: true }));
  await assertFails(set(ref(alice, path), { ...record, meta: { ...record.meta, revision: 2 }, body: 'x'.repeat(8_000_001) }));
  const code = 'a'.repeat(24), sharePath = `characterShares/${code}`;
  const shared = { ownerUid: 'alice', characterId: 'hero', createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 3600000, character: record };
  await assertFails(set(ref(stranger, sharePath), { ...shared, ownerUid: 'stranger' }));
  await assertFails(set(ref(bob, sharePath), shared));
  await assertSucceeds(set(ref(alice, sharePath), shared));
  await assertSucceeds(get(ref(bob, sharePath)));
  await assertFails(get(ref(anonymous, sharePath)));
  await assertFails(get(ref(stranger, sharePath)));
  await assertFails(get(ref(bob, 'characterShares'))); // codes cannot be enumerated
  await assertFails(set(ref(bob, sharePath), null));
  await assertFails(set(ref(alice, sharePath), shared)); // frozen snapshot
  await assertSucceeds(set(ref(alice, sharePath), null));
  const serverTimedPath = `characterShares/${'b'.repeat(24)}`;
  // This is the old client payload with a clock just one minute ahead: creation must be denied.
  await assertFails(set(ref(alice, serverTimedPath), { ...shared, createdAt: Date.now() + 60000 }));
  await assertFails(set(ref(alice, serverTimedPath), { ...shared, createdAt: serverTimestamp(), expiresAt: Date.now() + 86460000 }));
  // The client can be ahead or behind Firebase; only the server supplies this timestamp.
  const serverTimedShare = { ownerUid: 'alice', characterId: 'hero', createdAt: serverTimestamp(), character: record };
  await assertSucceeds(set(ref(alice, serverTimedPath), serverTimedShare));
  const serverTimed = (await assertSucceeds(get(ref(bob, serverTimedPath)))).val();
  if (typeof serverTimed.createdAt !== 'number') throw new Error('Share creation did not resolve its server timestamp.');
  await assertFails(set(ref(alice, serverTimedPath), serverTimedShare));
  await assertFails(set(ref(bob, serverTimedPath), null));
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), serverTimedPath), { ...serverTimed, createdAt: Date.now() - 86400001 });
  });
  await assertFails(get(ref(bob, serverTimedPath)));
  await assertSucceeds(set(ref(alice, serverTimedPath), null));
  await assertFails(get(ref(bob, sharePath)));
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), sharePath), { ...shared, expiresAt: Date.now() - 1000 });
  });
  await assertFails(get(ref(bob, sharePath)));
  await assertSucceeds(set(ref(alice, sharePath), null));
  const next = { ...record, meta: { ...record.meta, revision: 2 } };
  const racing = await Promise.allSettled([set(ref(alice, path), next), set(ref(alice, path), next)]);
  if (racing.filter(result => result.status === 'fulfilled').length !== 1) throw new Error('Concurrent saves did not have exactly one winner.');
  const deleted = { meta: { ...record.meta, revision: 3, deleted: true } };
  await assertFails(set(ref(alice, path), { meta: { ...record.meta, revision: 3 } })); // active records need a body
  await assertFails(set(ref(alice, path), { ...deleted, body: record.body })); // deleted records must remove it
  await assertFails(set(ref(bob, path), deleted));
  await assertSucceeds(set(ref(alice, path), deleted));
  const tombstone = (await assertSucceeds(get(ref(alice, path)))).val();
  if ('body' in tombstone || tombstone.meta.deleted !== true) throw new Error('Deletion retained the character definition.');
  await assertFails(set(ref(alice, path), deleted)); // tombstones retain revision protection
  await assertFails(set(ref(alice, path + '/body'), record.body));
  await assertFails(set(ref(alice, path), { meta: { ...record.meta, revision: 4 } }));
  await assertSucceeds(set(ref(alice, path), { ...record, meta: { ...record.meta, revision: 4 } })); // explicit conflict recovery
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), 'members/alice'), false);
  });
  await assertFails(get(ref(alice, path)));
  console.log('Database rules passed: membership, ownership, revisions, concurrency, size/schema validation and revocation.');
} finally { await environment.cleanup(); }
