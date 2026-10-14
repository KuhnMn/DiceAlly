import { ContentRecord, normalize, object, string } from '../content/content.model';
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
    return (record: ContentRecord): boolean => {
      switch (field) {
        case 'level': return typeof record.data['level'] === 'number' && values.includes(String(record.data['level']));
        case 'school': return values.includes(normalize(string(record.data['school'])));
        case 'source': return values.includes(normalize(record.publication));
        case 'components & miscellaneous': return object(record.data['meta'])?.['ritual'] === true;
        case 'spell attack': return Array.isArray(record.data['spellAttack']) && record.data['spellAttack'].some(v => values.includes(normalize(string(v))));
        case 'class': {
          const classes = object(record.data['classes']);
          return ['fromClassList','fromClassListVariant'].some(field => Array.isArray(classes?.[field])
            && (classes[field] as unknown[]).some(v => values.includes(normalize(string(object(v)?.['name'])))));
        }
        default: return false;
      }
    };
  });
  return [...records.values()].filter(record => record.kind === 'spell' && tests.every(test => test(record))).sort((a,b) => a.key.localeCompare(b.key));
}
