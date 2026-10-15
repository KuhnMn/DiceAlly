import { IndexedDbCharacterRepository } from '../indexeddb-character-repository';
import type { CharacterRecord } from '../character-repository';
import { CharacterCloud, decodeCloudCharacter, encodeCloudCharacter } from './character-cloud';

export interface SyncResult { changed: boolean; pending: number; conflicts: CharacterRecord[]; errors: string[]; }

/** Local rows are the durable outbox: edit version != acknowledged version means pending work. */
export class CharacterSyncEngine {
  constructor(private readonly local: IndexedDbCharacterRepository, private readonly cloud: CharacterCloud,
    private readonly active: () => boolean = () => true) {}

  async run(): Promise<SyncResult> {
    const result: SyncResult = { changed: false, pending: 0, conflicts: [], errors: [] };
    const localRows = await this.local.listAll();
    const ids = new Set([...localRows.map(row => row.id), ...await this.cloud.ids()]);
    for (const id of ids) {
      if (!this.active()) break;
      try { result.changed = await this.syncOne(id) || result.changed; }
      catch (error) { result.errors.push(error instanceof Error ? error.message : 'Synchronization failed.'); }
    }
    const rows = await this.local.listAll();
    result.pending = rows.filter(row => row.version !== row.syncedVersion).length;
    result.conflicts = rows.filter(row => row.conflict);
    return result;
  }

  private async syncOne(id: string): Promise<boolean> {
    const local = await this.local.get(id);
    const remote = await this.cloud.meta(id);
    if (!this.active()) return false;
    if (!local) return remote ? this.pull(id, 0) : false;
    if (local.conflict) return false; // Resolving a conflict is an explicit user decision.
    const dirty = local.version !== local.syncedVersion;
    if (!dirty) {
      if (remote && remote.hash === local.cloudHash) {
        if (remote.revision !== local.cloudRevision) await this.acknowledge(local, remote.revision, remote.hash);
        return false;
      }
      if (remote && remote.revision !== local.cloudRevision) return this.pull(id, local.version);
      if (!remote && local.cloudRevision) throw new Error('A cloud record disappeared unexpectedly. The local copy was retained.');
      return false;
    }
    const upload = await encodeCloudCharacter(local, (remote?.revision ?? 0) + 1);
    if (remote?.hash === upload.meta.hash) {
      // Handles a committed upload whose response/acknowledgement was lost.
      await this.acknowledge(local, remote.revision, remote.hash);
      return false;
    }
    if ((remote?.revision ?? 0) !== (local.cloudRevision ?? 0)) {
      if (remote) await this.captureConflict(local);
      else throw new Error('The cloud baseline is missing. The local copy was retained.');
      return false;
    }
    if (!this.active()) return false;
    try { await this.cloud.write(id, upload); }
    catch (error) {
      // A competing device may have won after our metadata read. Never retry against its new revision.
      const latest = await this.cloud.meta(id);
      if (latest?.hash === upload.meta.hash) await this.acknowledge(local, latest.revision, latest.hash);
      else if (latest && latest.revision !== (local.cloudRevision ?? 0)) await this.captureConflict(local);
      else throw error;
      return false;
    }
    await this.acknowledge(local, upload.meta.revision, upload.meta.hash);
    return false;
  }

  private async acknowledge(local: CharacterRecord, revision: number, hash: string) {
    await this.local.updateSync(local.id, current => ({ ...current, cloudRevision: revision,
      cloudHash: hash, syncedVersion: local.version }));
  }
  private async pull(id: string, expectedVersion: number) {
    const cloud = await this.cloud.read(id);
    if (!cloud || !this.active()) return false;
    const record = await decodeCloudCharacter(id, cloud);
    if (!this.active()) return false;
    await this.local.replaceFromCloud(record, expectedVersion);
    return true;
  }
  private async captureConflict(local: CharacterRecord) {
    const cloud = await this.cloud.read(local.id);
    if (!cloud || !this.active()) return;
    const remote = await decodeCloudCharacter(local.id, cloud);
    await this.local.updateSync(local.id, current => ({ ...current, conflict: {
      revision: cloud.meta.revision, hash: cloud.meta.hash, updatedAt: cloud.meta.updatedAt,
      deleted: cloud.meta.deleted, sheet: remote.sheet,
    } }));
  }

  async resolve(id: string, choice: 'local' | 'cloud' | 'both') {
    const record = await this.local.get(id);
    if (!record?.conflict || !this.active()) throw new Error('Conflict is no longer available.');
    const remote = record.conflict;
    if (choice === 'both') {
      // Persist the local alternative first. A reload halfway through cannot discard it.
      const copy = structuredClone(record.sheet);
      copy.character!.characterUuid = crypto.randomUUID();
      copy.character!.name = `${copy.character!.name || 'Character'} (Local Copy)`;
      await this.local.save(copy, 0);
    }
    if (choice === 'local') {
      await this.local.updateSync(id, current => {
        if (current.conflict?.revision !== remote.revision) return current;
        return { ...current, conflict: undefined, cloudRevision: remote.revision, cloudHash: remote.hash, syncedVersion: undefined };
      });
    } else {
      await this.local.replaceFromCloud({ id, sheet: remote.sheet, updatedAt: remote.updatedAt,
        version: 0, cloudRevision: remote.revision, cloudHash: remote.hash,
        deletedAt: remote.deleted ? remote.updatedAt : undefined }, record.version);
    }
  }
}
