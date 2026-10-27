import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, update, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';

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
  // Retired snapshots can only be queried and removed by their owner; no new bodies can accumulate.
  const legacyPath = `characterShares/${'a'.repeat(24)}`;
  const legacy = { ownerUid: 'alice', characterId: 'hero', createdAt: 1, character: record };
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), legacyPath), legacy);
    await set(ref(context.database(), `characterShares/${'b'.repeat(24)}`), { ...legacy, ownerUid: 'bob' });
  });
  await assertFails(set(ref(alice, `characterShares/${'c'.repeat(24)}`), legacy));
  await assertFails(get(ref(bob, legacyPath)));
  await assertFails(get(ref(alice, 'characterShares')));
  await assertFails(get(query(ref(bob, 'characterShares'), orderByChild('ownerUid'), equalTo('alice'), limitToFirst(10))));
  const oldShares = await assertSucceeds(get(query(ref(alice, 'characterShares'), orderByChild('ownerUid'), equalTo('alice'), limitToFirst(10))));
  if (Object.keys(oldShares.val()).length !== 1) throw new Error('Legacy cleanup exposed another owner.');
  await assertFails(set(ref(bob, legacyPath), null));
  await assertSucceeds(update(ref(alice), { [legacyPath]: null }));

  const sharedPath = 'users/alice/characters/sharedHero';
  const shareUpdates = (uid, id, code) => ({
    [`characterCodes/${code}`]: { ownerUid: uid, characterId: id },
    [`users/${uid}/shareCodes/${id}`]: code,
  });
  await assertSucceeds(set(ref(alice, sharedPath), record));
  const code = 'K7MP4R', codePath = `characterCodes/${code}`, indexPath = 'users/alice/shareCodes/sharedHero';
  await assertFails(set(ref(alice, codePath), { ownerUid: 'alice', characterId: 'sharedHero' }));
  await assertFails(set(ref(alice, indexPath), code));
  await assertFails(update(ref(bob), shareUpdates('alice', 'sharedHero', code)));
  await assertFails(update(ref(stranger), shareUpdates('stranger', 'sharedHero', code)));
  await assertFails(update(ref(alice), shareUpdates('alice', 'missingHero', code)));
  await assertFails(update(ref(alice), shareUpdates('alice', 'sharedHero', 'O0I1AB')));
  await assertSucceeds(update(ref(alice), shareUpdates('alice', 'sharedHero', code)));
  const link = (await assertSucceeds(get(ref(bob, codePath)))).val();
  if (Object.keys(link).sort().join() !== 'characterId,ownerUid') throw new Error('Sharing stored a duplicate character.');
  await assertSucceeds(get(ref(bob, sharedPath)));
  await assertFails(get(ref(bob, 'users/alice/characters')));
  await assertFails(get(ref(bob, 'users/alice/shareCodes')));
  await assertFails(get(ref(bob, 'characterCodes')));
  await assertFails(get(ref(anonymous, codePath)));
  await assertFails(get(ref(stranger, sharedPath)));
  await assertFails(set(ref(bob, sharedPath), { ...record, meta: { ...record.meta, revision: 2 } }));
  await assertSucceeds(set(ref(bob, 'users/bob/characters/hero'), record));
  await assertFails(update(ref(bob), shareUpdates('bob', 'hero', code))); // occupied codes cannot be overwritten
  await assertFails(update(ref(alice), shareUpdates('alice', 'sharedHero', 'ABC234'))); // only one code per character
  const updatedShared = { ...record, body: 'latest saved version', meta: { ...record.meta, revision: 2 } };
  await assertSucceeds(set(ref(alice, sharedPath), updatedShared));
  if ((await assertSucceeds(get(ref(bob, sharedPath)))).val().body !== updatedShared.body) throw new Error('Share did not resolve the latest character.');
  await assertFails(set(ref(alice, codePath), null)); // reciprocal links must be removed together
  await assertFails(set(ref(alice, indexPath), null));
  await assertFails(update(ref(bob), { [codePath]: null, [indexPath]: null }));
  await assertSucceeds(update(ref(alice), { [codePath]: null, [indexPath]: null }));
  await assertFails(get(ref(bob, sharedPath)));
  if ((await assertSucceeds(get(ref(bob, codePath)))).exists()) throw new Error('Revocation retained the code.');
  await assertSucceeds(update(ref(alice), shareUpdates('alice', 'sharedHero', code)));
  const sharedDeleted = { meta: { ...record.meta, revision: 3, deleted: true } };
  await assertFails(set(ref(alice, sharedPath), sharedDeleted)); // cannot leave a live link behind
  await assertSucceeds(update(ref(alice), { [sharedPath]: sharedDeleted, [codePath]: null, [indexPath]: null }));
  if ((await assertSucceeds(get(ref(alice, indexPath)))).exists()) throw new Error('Deletion retained the owner index.');
  if ((await assertSucceeds(get(ref(bob, codePath)))).exists()) throw new Error('Deletion retained the public code.');
  await assertFails(get(ref(bob, sharedPath)));
  await assertFails(update(ref(alice), shareUpdates('alice', 'sharedHero', code)));
  await assertSucceeds(set(ref(alice, sharedPath), { ...record, meta: { ...record.meta, revision: 4 } }));
  await assertFails(get(ref(bob, sharedPath))); // restoring a character does not resurrect a revoked link

  await assertSucceeds(set(ref(alice, 'users/alice/characters/raceHero'), record));
  const simultaneousShares = await Promise.allSettled([
    update(ref(alice), shareUpdates('alice', 'raceHero', 'ABC234')),
    update(ref(alice), shareUpdates('alice', 'raceHero', 'DEF567')),
  ]);
  if (simultaneousShares.filter(result => result.status === 'fulfilled').length !== 1) throw new Error('Concurrent sharing created duplicate codes.');
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
