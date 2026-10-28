import { classDefinition } from '../content/class-adapter';
import { subclassMatchesClass, usesLegacySubclass } from '../content/class-compatibility';
import { object } from '../content/content.model';
import { ContentClassSelection, ContentRulesIndex } from './feature-rules';
import { OptionalFeatureSlot } from './optional-feature-rules';
/** Counts are cumulative totals, not increments at each level. */
export function deriveOptionalSlots(selections: ContentClassSelection[],index: ContentRulesIndex,
  answers: Readonly<Record<string,readonly string[]>> = {}) {
  const slots: OptionalFeatureSlot[] = []; const diagnostics: string[] = []; const ids = new Set<string>();
  const classes = new Set<string>();
  if (!index.sourceIdentity || !index.revisionId) diagnostics.push('Pinned progression context is required.');
  if (selections.reduce((sum,s) => sum + s.level,0) > 20) diagnostics.push('Total class level exceeds 20.');
  for (const selection of selections) {
    if (!selection.selectionId || ids.has(selection.selectionId) || classes.has(selection.classKey) || !Number.isInteger(selection.level) || selection.level < 1 || selection.level > 20) {
      diagnostics.push('Invalid progression class selection.'); continue;
    }
    ids.add(selection.selectionId); classes.add(selection.classKey);
    try {
      const parent = index.records.get(selection.classKey); const sub = selection.subclassKey ? index.records.get(selection.subclassKey) : undefined;
      if (!parent || parent.kind !== 'class' || (selection.subclassKey && (!sub || sub.kind !== 'subclass'
        || !subclassMatchesClass(sub, parent)))) {
        diagnostics.push('Invalid progression class/subclass ancestry.'); continue;
      }
      for (const owner of [parent,...(sub ? [sub] : [])]) {
        if (owner.kind === 'subclass' && usesLegacySubclass(parent, owner) && selection.level < 3) continue;
        const progression = classDefinition(owner).optionalFeatures;
        progression.forEach((raw,position) => {
          const entry = raw; const types = entry.featureType; const values = entry.progression;
          const name = entry.name; const id = JSON.stringify(['optional-slot',index.sourceIdentity,selection.selectionId,owner.key,position,name]);
          if (Object.keys(entry).some(k => !['name','featureType','progression'].includes(k)) || !types.length) {
            diagnostics.push(`Optional progression handler required for ${id}`); return;
          }
          let count: unknown;
          if (Array.isArray(values)) {
            if (values.some(v => !Number.isInteger(v) || Number(v) < 0) || values.length < selection.level) { diagnostics.push(`Invalid progression table: ${id}`); return; }
            count = values[selection.level - 1];
          } else {
            const table = object(values);
            if (!table || Object.entries(table).some(([level,n]) => !/^\d+$/.test(level) || Number(level) < 1 || Number(level) > 20 || !Number.isInteger(n) || Number(n) < 0)) {
              diagnostics.push(`Unsupported progression table: ${id}`); return;
            }
            const eligible = Object.keys(table).map(Number).filter(level => level <= selection.level).sort((a,b) => b-a);
            count = eligible.length ? table[String(eligible[0])] : 0;
          }
          if (typeof count !== 'number' || count > 100) { diagnostics.push(`Invalid optional count: ${id}`); return; }
          if (count === 0) return;
          slots.push({ id,selectionId: selection.selectionId,ownerKey: owner.key,count,featureTypes: [...types] as string[],
            selectedKeys: Object.hasOwn(answers,id) ? [...answers[id]] : [] });
        });
      }
    } catch (error) { diagnostics.push(String(error)); }
  }
  return { canAccept: diagnostics.length === 0,slots,diagnostics };
}
