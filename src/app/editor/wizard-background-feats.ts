import { ContentRecord, entityKey, object } from '../content/content.model';
import { characterOption } from '../content/character-option-adapter';
import { isCompleteSelection } from '../rules/spell-choice';
import type { WizardChoice } from './class-wizard-preview';

/** Background feats follow the schema's alternative packages, fixed grants and choices. */
export function wizardBackgroundFeats(background: ContentRecord, records: ReadonlyMap<string, ContentRecord>,
  answers: Readonly<Record<string, readonly string[]>>, visible: (record: ContentRecord) => boolean) {
  const choices: WizardChoice[] = [], warnings: string[] = [];
  const feats = new Map<string, ContentRecord>();
  const packages = background.data['feats'];
  if (!Array.isArray(packages)) return { feats: [], choices, warnings };
  const prefix = `background-feats:${background.key}`;
  let position = 0;
  if (packages.length > 1) {
    choices.push({ id: prefix, ownerKey: background.key, scope: 'features', label: `${background.name}: Feat options`, count: 1,
      candidates: packages.map((_, index) => ({ value: String(index), label: `Option ${index + 1}` })) });
    if (!isCompleteSelection(answers[prefix] ?? [], 1, packages.map((_, index) => String(index)))) return { feats: [], choices, warnings };
    position = Number(answers[prefix][0]);
  }
  const grant = object(packages[position]);
  if (!grant) return { feats: [], choices, warnings };
  for (const [token, enabled] of Object.entries(grant)) {
    if (enabled !== true || !token.includes('|')) continue;
    const [name, publication] = token.split('|');
    const record = records.get(entityKey('feat', { name, source: publication }));
    if (record?.kind === 'feat') feats.set(record.key, record);
    else warnings.push(`${background.name}: Missing background feat ${token}. Import its source book to add it.`);
  }
  const category = object(grant['anyFromCategory']);
  for (const [kind, count] of [['any', grant['any']], ['category', category?.['count'] ?? (category ? 1 : undefined)]] as const) {
    if (typeof count !== 'number' || count < 1) continue;
    const categories = category?.['category'];
    const candidates = [...records.values()].filter(record => record.kind === 'feat' && !feats.has(record.key)
      && visible(record) && (kind !== 'category' || Array.isArray(categories) && categories.includes(characterOption(record).category ?? '')));
    const id = `${prefix}:${position}:${kind}`;
    choices.push({ id, ownerKey: background.key, scope: 'features', label: `${background.name}: ${kind === 'category' ? 'Category feats' : 'Feats'}`, count,
      candidates: candidates.map(record => ({ value: record.key, label: `${record.name} (${record.publication})` })) });
    if (isCompleteSelection(answers[id] ?? [], count, candidates.map(record => record.key))) {
      for (const key of answers[id]) feats.set(key, records.get(key)!);
    }
  }
  return { feats: [...feats.values()], choices, warnings };
}
