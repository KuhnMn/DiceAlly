import 'fake-indexeddb/auto';
import { emptyBasicCharacter } from '../editor/basic-info';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { IndexedDbCharacterRepository } from './indexeddb-character-repository';
import { encodeCloudCharacter } from './sync/character-cloud';

describe('Portable character metadata', () => {
  it('ignores legacy installation identity on import, local persistence, and cloud upload', async () => {
    const sheet = Object.assign(emptyBasicCharacter(), { installationId: 'old-android-device' });
    const imported = normalizeCharacterEditorIdentity(sheet);
    expect('installationId' in imported).toBe(false);
    expect(sheet.installationId).toBe('old-android-device');
    const repository = new IndexedDbCharacterRepository(`portable-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const record = (await repository.get(sheet.character!.characterUuid!))!;
    expect('installationId' in record.sheet).toBe(false);
    const cloud = await encodeCloudCharacter({ ...record, sheet }, 1);
    expect(JSON.parse(cloud.body).installationId).toBeUndefined();
    expect(JSON.parse(cloud.body).character.characterUuid).toBe(sheet.character!.characterUuid);
  });
});
