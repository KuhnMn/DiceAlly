import type { SpellDefinition } from '../content/spell.model';
import { ContentRecord, normalize } from '../content/content.model';
import { spellDefinition } from '../content/spell-adapter';
/** AND between clauses, OR between semicolon values. Only audited upstream fields are supported. */
export function filterSpells(query: unknown, records: ReadonlyMap<string, ContentRecord>): ContentRecord[] {
  if (typeof query !== 'string' || query.length > 4096) throw new Error('Invalid spell filter expression.');
  const clauses = query.trim() ? query.split('|') : [];
  if (clauses.length > 16) throw new Error('Too many spell filter clauses.');
  const tests = clauses.map(clause => {
    const parts = clause.split('=');
    if (parts.length !== 2) throw new Error(`Unsupported spell filter syntax: ${clause}`);
    const field = normalize(parts[0]); const values = parts[1].split(';').map(normalize);
    if (!values.length || values.length > 128 || values.some(v => !v || /[!\[\]:]/.test(v))) throw new Error(`Unsupported spell filter values: ${clause}`);
    if (!['level','class','school','source','spell attack','components & miscellaneous'].includes(field)) throw new Error(`Unsupported spell filter field: ${field}`);
    if (field === 'level' && values.some(v => !/^[0-9]$/.test(v))) throw new Error('Invalid spell filter level.');
    if (field === 'components & miscellaneous' && values.some(v => v !== 'ritual')) throw new Error('Unsupported miscellaneous spell filter.');
    return (record: ContentRecord, definition: SpellDefinition): boolean => {
      switch (field) {
        case 'level': return values.includes(String(definition.level));
        case 'school': return values.includes(normalize(definition.school ?? ''));
        case 'source': return values.includes(normalize(record.publication));
        case 'components & miscellaneous': return definition.meta?.ritual === true;
        case 'spell attack': return definition.spellAttack?.some(attack => values.includes(normalize(attack))) === true;
        case 'class': {
          return [...definition.memberships.fromClassList, ...definition.memberships.fromClassListVariant].some(entry => values.includes(normalize(entry.name)));
        }
        default: return false;
      }
    };
  });
  return [...records.values()].filter(record => {
    if (record.kind !== 'spell') return false;
    const definition = spellDefinition(record);
    return tests.every(test => test(record, definition));
  }).sort((a,b) => a.key.localeCompare(b.key));
}
