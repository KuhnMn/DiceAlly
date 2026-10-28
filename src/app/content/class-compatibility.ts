import { classDefinition } from './class-adapter';
import { ContentRecord, normalize } from './content.model';

function edition(record: ContentRecord): string {
  return typeof record.data['edition'] === 'string' ? record.data['edition']
    : record.publication === 'XPHB' ? 'one' : 'classic';
}

/** The source's edition hint allows classic subclasses on their revised class. */
export function usesLegacySubclass(parent: ContentRecord, subclass: ContentRecord): boolean {
  return parent.kind === 'class' && subclass.kind === 'subclass'
    && edition(parent) === 'one' && edition(subclass) === 'classic'
    && normalize(classDefinition(subclass).parent?.name ?? '') === normalize(parent.name);
}

export function subclassMatchesClass(subclass: ContentRecord, parent: ContentRecord): boolean {
  return subclass.kind === 'subclass' && parent.kind === 'class'
    && (classDefinition(subclass).parent?.key === parent.key || usesLegacySubclass(parent, subclass));
}

export function subclassFeatureLevel(level: number, parent: ContentRecord, subclass: ContentRecord): number {
  return usesLegacySubclass(parent, subclass) ? Math.max(3, level) : level;
}
