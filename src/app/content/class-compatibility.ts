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
    && (classDefinition(subclass).parent?.key === (parent.homebrewVariant?.originalKey ?? parent.key) || usesLegacySubclass(parent, subclass));
}

/** Retain the selected subclass's qualified ancestry, including synthetic classic copies. */
export function subclassFeatureMatchesClass(feature: ContentRecord, parent: ContentRecord, subclass: ContentRecord): boolean {
  if (feature.kind !== 'subclassFeature' || !subclassMatchesClass(subclass, parent)) return false;
  const definition = classDefinition(feature), selected = classDefinition(subclass);
  const expectedParent = selected.parent?.key;
  const legacyParent = usesLegacySubclass(parent, subclass)
    && expectedParent === (parent.homebrewVariant?.originalKey ?? parent.key)
    && normalize(definition.parent?.name ?? '') === normalize(parent.name);
  return (definition.parent?.key === expectedParent || legacyParent)
    && normalize(definition.subclass?.shortName ?? '') === normalize(selected.shortName ?? subclass.name)
    && normalize(definition.subclass?.source ?? '') === normalize(subclass.publication);
}

export function subclassFeatureLevel(level: number, parent: ContentRecord, subclass: ContentRecord): number {
  return usesLegacySubclass(parent, subclass) ? Math.max(3, level) : level;
}
