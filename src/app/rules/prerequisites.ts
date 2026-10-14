import { entityKey, normalize, object, string } from '../content/content.model';
export interface PrerequisiteContext {
  totalLevel: number;
  classes: { name: string; publication: string; level: number }[];
  spells: ReadonlySet<string>;
  optionalFeatures: ReadonlySet<string>;
  pacts: ReadonlySet<string>;
  abilities?: Readonly<Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',number>>>;
}
/** OR between alternatives, AND within one alternative; unsupported conditions cannot pass. */
export function checkPrerequisites(value: unknown, context: PrerequisiteContext) {
  if (value === undefined) return { satisfied: true,diagnostics: [] as string[] };
  if (!Array.isArray(value)) return { satisfied: false,diagnostics: ['Prerequisites must be an array.'] };
  if (!value.length) return { satisfied: true,diagnostics: [] as string[] };
  const alternativeFailures: string[] = [];
  for (const raw of value) {
    const alternative = object(raw);
    let satisfied = true;
    const requirementDiagnostics: string[] = [];
    if (!alternative || !Object.keys(alternative).length) { alternativeFailures.push('Invalid prerequisite alternative.'); continue; }
    for (const [field, requirement] of Object.entries(alternative)) {
      let matches = false;
      if (field === 'level') {
        const data = object(requirement);
        const level = typeof requirement === 'number' ? requirement : data?.['level'];
        const requiredClass = object(data?.['class']);
        if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 20) requirementDiagnostics.push('Invalid prerequisite level.');
        else if (requiredClass) {
          const source = string(requiredClass['source']);
          if (!string(requiredClass['name']) || !source) requirementDiagnostics.push('Class prerequisite requires an exact publication.');
          else matches = context.classes.some(c => normalize(c.name) === normalize(string(requiredClass['name'])) && normalize(c.publication) === normalize(source) && c.level >= level);
        } else if (data && data['class'] !== undefined) requirementDiagnostics.push('Invalid prerequisite class.');
        else matches = context.totalLevel >= level;
      } else if (field === 'ability') {
        // Alternatives between score objects; all thresholds inside one object must hold.
        if (!Array.isArray(requirement) || !requirement.length || requirement.some(raw => {
          const scores = object(raw);
          return !scores || !Object.keys(scores).length || Object.entries(scores).some(([ability,threshold]) =>
            !['str','dex','con','int','wis','cha'].includes(ability) || !Number.isSafeInteger(threshold) || Number(threshold) < 1 || Number(threshold) > 30);
        })) requirementDiagnostics.push('Ability prerequisite handler required for malformed/unsupported thresholds.');
        else matches = requirement.some(raw => Object.entries(object(raw)!).every(([ability,threshold]) => {
          const score = context.abilities?.[ability as keyof NonNullable<PrerequisiteContext['abilities']>];
          return typeof score === 'number' && Number.isSafeInteger(score) && score >= 1 && score <= 30 && score >= Number(threshold);
        }));
      } else if (field === 'spell' || field === 'optionalfeature') {
        if (!Array.isArray(requirement) || !requirement.length || requirement.some(v => typeof v !== 'string')) requirementDiagnostics.push(`Prerequisite ${field} selector requires a handler.`);
        else matches = (requirement as string[]).every(token => {
          const [name,source] = token.replace(/#[^#]*$/, '').split('|');
          if (!name.trim()) return false;
          return (field === 'spell' ? context.spells : context.optionalFeatures).has(entityKey(field, { name,source: source || 'PHB' }));
        });
      } else if (field === 'pact' && typeof requirement === 'string') matches = [...context.pacts].some(p => normalize(p) === normalize(requirement));
      else requirementDiagnostics.push(`Prerequisite handler required for ${field}.`);
      if (!matches) { satisfied = false; if (!requirementDiagnostics.length) requirementDiagnostics.push(`Unmet ${field} prerequisite.`); }
    }
    // One fully satisfied alternative is enough, even if earlier alternatives failed.
    if (satisfied) return { satisfied: true,diagnostics: [] as string[] };
    alternativeFailures.push(...requirementDiagnostics);
  }
  return { satisfied: false,diagnostics: [...new Set(alternativeFailures)] };
}
