import type { CharacterRecord } from '../character-repository';
import type { ExportedCharacter } from '../../models/character.model';
import { canonicalDocument } from '../../rules/canonical-document';
import { portableCharacter } from '../portable-character';
import { validateSpeciesEntity } from '../../content/species-compatibility';

export interface CloudCharacterMeta {
  revision: number;
  hash: string;
  updatedAt: string;
  deleted: boolean;
}
export interface CloudCharacter { meta: CloudCharacterMeta; body: string; }
export interface CharacterCloud {
  ids(): Promise<string[]>;
  meta(id: string): Promise<CloudCharacterMeta | null>;
  read(id: string): Promise<CloudCharacter | null>;
  write(id: string, record: CloudCharacter): Promise<void>;
}

/** Hash the exact portable JSON plus deletion state. No backend-specific fields enter exports. */
export async function characterHash(body: string, deleted: boolean): Promise<string> {
  const bytes = new TextEncoder().encode(`${deleted ? 'deleted' : 'active'}\n${body}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function encodeCloudCharacter(record: CharacterRecord, revision: number): Promise<CloudCharacter> {
  assertExternalIllustrations(record.sheet);
  const body = JSON.stringify(portableCharacter(record.sheet));
  if (new TextEncoder().encode(body).length > 8_000_000) throw new Error('Character exceeds the 8 MB cloud save limit.');
  const deleted = !!record.deletedAt;
  return { body, meta: { revision, hash: await characterHash(body, deleted), deleted, updatedAt: record.updatedAt } };
}

/** Reject embedded files before upload; artwork must be hosted elsewhere. */
export function assertExternalIllustrations(value: unknown): void {
  if (typeof value === 'string' && /^\s*(data:|blob:)/i.test(value)) {
    throw new Error('Embedded illustrations cannot be synced. Replace them with external image URLs.');
  }
  if (Array.isArray(value)) value.forEach(assertExternalIllustrations);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertExternalIllustrations);
}

export function validateMeta(value: unknown): CloudCharacterMeta {
  const meta = value as CloudCharacterMeta | null;
  if (!meta || !Number.isSafeInteger(meta.revision) || meta.revision < 1 ||
      typeof meta.hash !== 'string' || !/^[a-f0-9]{64}$/.test(meta.hash) ||
      typeof meta.deleted !== 'boolean' || typeof meta.updatedAt !== 'string' || !Number.isFinite(Date.parse(meta.updatedAt))) {
    throw new Error('Invalid cloud character metadata.');
  }
  return meta;
}

export async function decodeCloudCharacter(id: string, value: CloudCharacter): Promise<CharacterRecord> {
  const meta = validateMeta(value.meta);
  if (typeof value.body !== 'string' || await characterHash(value.body, meta.deleted) !== meta.hash) throw new Error('Cloud character integrity check failed.');
  const sheet = portableCharacter(JSON.parse(value.body) as ExportedCharacter);
  canonicalDocument(sheet);
  validateSpeciesEntity(sheet.species?.entity);
  if (sheet.character?.characterUuid !== id) throw new Error('Cloud character identity does not match its record.');
  assertExternalIllustrations(sheet);
  return { id, sheet, version: 0, updatedAt: meta.updatedAt, deletedAt: meta.deleted ? meta.updatedAt : undefined,
    cloudRevision: meta.revision, cloudHash: meta.hash };
}
