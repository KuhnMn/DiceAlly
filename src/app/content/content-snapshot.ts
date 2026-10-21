import type { ContentRecord } from './content.model';
import { canonicalCharacterOption } from './character-option-adapter';
import { canonicalClassRecord } from './class-adapter';
import { canonicalItemRecord } from './item-adapter';
import { canonicalMonsterRecord } from './monster-adapter';
import { canonicalSpeciesRecord } from './species-adapter';
import { canonicalSpellRecord } from './spell-adapter';

/** Historical native dependency snapshots use the same mapping on validation and draft load. */
export function canonicalContentSnapshot(record: ContentRecord): ContentRecord {
  switch (record.kind) {
    case 'species':
      return canonicalSpeciesRecord(record, 'legacy');
    case 'class':
    case 'subclass':
    case 'classFeature':
    case 'subclassFeature':
      return canonicalClassRecord(record);
    case 'feat':
    case 'optionalfeature':
    case 'background':
      return canonicalCharacterOption(record);
    case 'spell':
      return canonicalSpellRecord(record);
    case 'item':
      return canonicalItemRecord(record);
    case 'monster':
      return canonicalMonsterRecord(record);
    default:
      return record;
  }
}
