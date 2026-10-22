import type { ContentRecord, ImportRevision } from '../content/content.model';
import type { ObjectCompanion } from '../models/companions';
import { contentReference } from './editor-content-helpers';
import { newEditorId } from './editor-identity';

export function createObjectEntry(record: ContentRecord, revision: ImportRevision): ObjectCompanion {
  const definition = record.referenceDefinition;
  if (record.kind !== 'object' || definition?.kind !== 'object' || definition.version !== 1) throw new Error('Select a canonical object record.');
  const { kind: _, ...entity } = definition;
  return { kind: 'object', editorId: newEditorId(), name: record.name, source: record.publication, userAdded: true,
    contentReference: contentReference(record, revision), entity: structuredClone(entity),
    hitPoints: { enabled: false }, notes: [], uses: [] };
}
