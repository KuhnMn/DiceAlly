import type { BastionDefinition } from '../content/bastion.model';
import type { ContentRecord, ImportRevision } from '../content/content.model';
import type { FacilityEntry } from '../models/bastion';
import { contentReference } from './editor-content-helpers';
import { newEditorId } from './editor-identity';

export function facilitySnapshot(record: ContentRecord): BastionDefinition {
  if (record.kind !== 'facility') throw new Error('Expected a bastion facility.');
  return structuredClone(record.referenceDefinition?.kind === 'facility'
    ? record.referenceDefinition : { ...record.data, name: record.name, source: record.publication, version: 1 }) as BastionDefinition;
}

export function createFacilityEntry(record: ContentRecord, revision: ImportRevision): FacilityEntry {
  return { editorId: newEditorId(), name: record.name, source: record.publication,
    contentReference: contentReference(record, revision), entity: facilitySnapshot(record), userAdded: true,
    notes: [] };
}
