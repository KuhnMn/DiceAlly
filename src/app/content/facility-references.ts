import type { BastionDefinition } from './bastion.model';
import { visitEntryTree } from './content-entries';
import { referenceDefaultSource, referenceEdition } from './reference-edition';

export interface FacilityReference { category: 'reward' | 'table'; name: string; source: string; }

/** Follow explicit source tags. Book prose is a table lookup only when it names a table/list. */
export function facilityReferences(facility: BastionDefinition): FacilityReference[] {
  const references = new Map<string, FacilityReference>();
  visitEntryTree(facility.entries, 'entries', text => {
    for (const match of text.matchAll(/\{@(reward|table|book)\s+([^{}]+)\}/g)) {
      const [label, source, , section] = match[2].split('|').map(value => value.trim());
      if (match[1] === 'book' && !/\b(tables?|lists?|hauntings)\b/i.test(label + ' ' + (section ?? ''))) continue;
      const category = match[1] === 'reward' ? 'reward' : 'table';
      const name = match[1] === 'book' ? section || label : label;
      const publication = source || referenceDefaultSource('DMG', referenceEdition(facility.source));
      const reference: FacilityReference = { category, name, source: publication };
      references.set(JSON.stringify([category, name.toLowerCase(), publication.toLowerCase()]), reference);
    }
  }, () => {});
  return [...references.values()];
}
