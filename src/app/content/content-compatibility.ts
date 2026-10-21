import { ADAPTER_VERSION, ImportRevision } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';

/** Historical snapshots remain separate from the current import-library contract. */
export function requiresContentReimport(revision: ImportRevision): boolean {
  return revision.adapterVersion !== ADAPTER_VERSION || revision.schemaSnapshot !== CONTENT_SCHEMA_ID;
}
