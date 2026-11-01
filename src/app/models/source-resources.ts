import type { ExportedCharacter } from './character.model';
export interface SourceResource {
  id: string;
  sourceId: string;
  name: string;
  mode: 'counter' | 'note' | 'both';
  note: string;
  total: number;
  used: number;
  recovery: string;
  features: boolean;
  spells: boolean;
  /** Legacy 1.2.0 field; ignored. Spells require explicit links. */
  casting?: boolean;
  defaultCost?: number;
}
export interface ResourceCost {
  resourceId: string;
  amount: number;
}
export function remainingResource(resource: SourceResource): number {
  return Math.max(0, resource.total - resource.used);
}
export function resourceCosts(
  sheet: ExportedCharacter,
  links: ResourceCost[] = [],
): ResourceCost[] {
  const costs = [...links];
  return costs.filter(
    (cost, index) =>
      Number.isSafeInteger(cost.amount) &&
      cost.amount > 0 &&
      costs.findIndex((entry) => entry.resourceId === cost.resourceId) === index &&
      sheet.resources?.some(
        (resource) => resource.id === cost.resourceId && resource.mode !== 'note',
      ),
  );
}
/** Validate against the latest document; exhaustion never partially spends a pool. */
export function spendResource(
  sheet: ExportedCharacter,
  cost: ResourceCost,
): ExportedCharacter | null {
  const pool = sheet.resources?.find((resource) => resource.id === cost.resourceId);
  if (
    !pool ||
    pool.mode === 'note' ||
    !Number.isSafeInteger(cost.amount) ||
    cost.amount <= 0 ||
    !Number.isSafeInteger(pool.used) ||
    pool.used < 0 ||
    !Number.isSafeInteger(pool.total) ||
    remainingResource(pool) < cost.amount
  )
    return null;
  return {
    ...sheet,
    resources: sheet.resources!.map((resource) =>
      resource.id === pool.id ? { ...resource, used: resource.used + cost.amount } : resource,
    ),
  };
}
export function recoverResources(sheet: ExportedCharacter, rest: 'short' | 'long'): void {
  for (const resource of sheet.resources ?? []) {
    if (resource.mode === 'note') continue;
    if (
      resource.recovery === 'SHORT_REST' ||
      (rest === 'long' && resource.recovery === 'LONG_REST')
    )
      resource.used = 0;
    else if (resource.recovery === 'SHORT_REST_ONE') resource.used = Math.max(0, resource.used - 1);
  }
}
export function validateResources(sheet: ExportedCharacter): void {
  const imports = sheet.creatorWizard?.resourceImports;
  if (imports !== undefined && (!imports || typeof imports !== 'object' || Array.isArray(imports)
    || Object.values(imports).some(setting => !setting || typeof setting !== 'object' || Array.isArray(setting)
      || typeof setting.enabled !== 'boolean' || setting.name !== undefined && typeof setting.name !== 'string'
      || setting.reminderId !== undefined && typeof setting.reminderId !== 'string')))
    throw new Error('Invalid resource import mapping.');
  if (sheet.resources !== undefined && !Array.isArray(sheet.resources))
    throw new Error('Invalid resources.');
  const ids = new Set<string>();
  for (const resource of sheet.resources ?? []) {
    if (
      !resource ||
      typeof resource.id !== 'string' ||
      !resource.id ||
      ids.has(resource.id) ||
      typeof resource.sourceId !== 'string' ||
      typeof resource.name !== 'string' ||
      !resource.name.trim() ||
      !['counter', 'note', 'both'].includes(resource.mode) ||
      typeof resource.note !== 'string' ||
      !Number.isSafeInteger(resource.total) ||
      resource.total < 0 ||
      !Number.isSafeInteger(resource.used) ||
      resource.used < 0 ||
      !['NONE', 'LONG_REST', 'SHORT_REST', 'SHORT_REST_ONE'].includes(resource.recovery) ||
      ['features', 'spells'].some(
        (key) => typeof resource[key as 'features'] !== 'boolean',
      )
    )
      throw new Error('Invalid resource configuration.');
    ids.add(resource.id);
  }
  for (const entry of [...(sheet.features ?? []), ...(sheet.spells ?? [])]) {
    if (
      entry.resourceLinks !== undefined &&
      (!Array.isArray(entry.resourceLinks) ||
        entry.resourceLinks.some(
          (link) =>
            !link ||
            typeof link.resourceId !== 'string' ||
            !Number.isSafeInteger(link.amount) ||
            link.amount < 1,
        ))
    )
      throw new Error('Invalid resource link.');
  }
}
