// Structural inventory, not an assertion that every schema branch is automated.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { kindSchemas, referenceSchemas, snapshotDirectory } from './content-schema-config.mjs';

const manifest = JSON.parse(await readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8'));
const families = {};
for (const profile of ['site', 'brew']) {
  const schemas = new Map(await Promise.all(Object.entries(manifest.profiles[profile]).map(async ([file, info]) =>
    [info.uri ?? file, JSON.parse(await readFile(path.join(snapshotDirectory, profile, file), 'utf8'))])));
  const variants = (file, pointer, ancestors = new Set()) => {
    const identity = `${file}#${pointer}`;
    if (ancestors.has(identity)) throw new Error(`Unexpected recursive outer record: ${identity}`);
    const seen = new Set([...ancestors, identity]);
    let schema = schemas.get(file);
    for (const token of pointer.split('/').slice(1)) schema = schema?.[token.replaceAll('~1', '/').replaceAll('~0', '~')];
    if (!schema) throw new Error(`Missing record contract: ${identity}`);
    if (schema.$ref) {
      const [target, fragment = ''] = schema.$ref.split('#');
      const resolved = target ? path.posix.normalize(path.posix.join(path.posix.dirname(file), target)) : file;
      return variants(resolved, fragment, seen);
    }
    const union = schema.anyOf ? 'anyOf' : schema.oneOf ? 'oneOf' : undefined;
    if (union) return schema[union].flatMap((_branch, index) => variants(file, `${pointer}/${union}/${index}`, seen));
    return [{ schemaPath: identity, required: schema.required ?? [], fields: Object.keys(schema.properties ?? {}),
      additionalProperties: schema.additionalProperties ?? true }];
  };
  families[profile] = Object.fromEntries(Object.entries(kindSchemas).map(([kind, file]) => [kind, {
    file, sourceVersion: schemas.get(file).version, variants: variants(file, `/properties/${kind}/items`),
    validation: 'implemented', canonicalConsumerMigration: ['race', 'subrace'].includes(kind) ? 'playable-species-mechanics-implemented'
      : ['class', 'subclass', 'classFeature', 'subclassFeature'].includes(kind) ? 'class-family-mechanics-implemented'
      : ['feat', 'optionalfeature', 'background'].includes(kind) ? 'selection-and-proficiency-fields-implemented'
      : kind === 'spell' ? 'existing-spell-consumers-implemented'
      : kind === 'item' ? 'materialized-equipment-fields-implemented'
      : kind === 'itemEntry' ? 'reusable-item-entry-expansion-implemented'
      : kind === 'monster' ? 'catalog-and-projected-stat-fields-implemented'
      : Object.hasOwn(referenceSchemas, kind) ? 'typed-reference-storage-implemented' : 'pending',
  }]));
}

const consumers = [];
const templates = [];
async function visit(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'generated') await visit(file); continue; }
    if (file.endsWith('.html')) {
      const text = await readFile(file, 'utf8');
      if (/\bentity\b|getItemProp\(/.test(text)) templates.push(file);
      continue;
    }
    if (!file.endsWith('.ts') || /\.(spec|testing)\.ts$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const imports = ast.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
      .filter(name => /(?:content|character)\.model$/.test(name));
    if (!imports.length) continue;
    const fields = [];
    const walk = node => {
      if (ts.isElementAccessExpression(node)) {
        const expression = node.expression.getText(ast);
        if (/\bdata$|\.data$|\bentity$|\.entity$/.test(expression)) {
          fields.push({ line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
            expression, field: ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : '<dynamic>' });
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(ast);
    consumers.push({ file, imports, fields });
  }
}
await visit('src/app');
const inventory = { schemaCommit: manifest.commit, families,
  canonicalModels: { species: { version: 1, schema: 'schemas/content/species.json',
    sourceKinds: ['race', 'subrace'],
    migratedFields: ['speed', 'ability', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'size', 'creatureTypes', 'darkvision', 'blindsight', 'tremorsense', 'truesight'],
    remainingPayload: ['entries', 'proficiency grants', 'additionalSpells', 'other source metadata'],
    abilityAutomation: 'inactive; manual character scores remain authoritative' },
    class: { version: 1, schema: 'schemas/content/class.json', sourceKinds: ['class', 'subclass', 'classFeature', 'subclassFeature'],
      migratedFields: ['parent identity', 'subclass identity', 'feature levels', 'feature references', 'hit dice', 'saving throws', 'primary abilities', 'casting metadata', 'starting proficiencies', 'multiclass proficiencies', 'optional feature progression'],
      remainingPayload: ['entries', 'additionalSpells', 'multiclass requirements and descriptions', 'equipment', 'tables', 'feat/mastery progressions', 'other source metadata'],
      exportCompatibility: 'native snapshots carry the canonical contract; portable features retain conventional Android metadata' },
    characterOption: { version: 1, schema: 'schemas/content/character-option.json', sourceKinds: ['feat', 'optionalfeature', 'background'],
      migratedFields: ['prerequisites', 'feat category', 'optional feature types', 'skill/language/tool/armor/weapon proficiencies'],
      remainingPayload: ['entries', 'ability metadata', 'additionalSpells', 'other source metadata'],
      automation: 'existing behavior only; no new grants or prerequisite handlers' },
    spell: { version: 1, schema: 'schemas/content/spell.json', sourceKinds: ['spell'],
      migratedFields: ['level', 'school', 'casting times', 'range', 'components', 'durations', 'meta', 'spell attacks', 'class memberships'],
      remainingPayload: ['entries', 'higher-level entries', 'damage/scaling metadata', 'other source metadata'],
      exportCompatibility: 'portable spell entities retain conventional fields and flat class lists; no new casting behavior' },
    item: { version: 1, schema: 'schemas/content/item.json', sourceKinds: ['item'],
      migratedFields: ['type', 'rarity', 'attunement', 'armor/weapon statistics', 'bonuses', 'weight/value', 'property/mastery UIDs and notes', 'equipment flags'],
      remainingPayload: ['entries', 'base-item provenance', 'attached spells', 'other source metadata'],
      sourceInputs: 'baseitem/itemGroup/magicvariant and type/property/mastery definitions remain materialization inputs',
      exportCompatibility: 'inventory retains the conventional self-contained DisplayItem projection' },
    monster: { version: 1, schema: 'schemas/content/monster.json', sourceKinds: ['monster'],
      migratedFields: ['size/type/alignment', 'AC/HP', 'movement', 'initiative', 'ability scores', 'senses/passive', 'languages/CR', 'defenses'],
      remainingPayload: ['save/skill maps with special entries', 'actions/traits', 'spellcasting', 'other source metadata'],
      exportCompatibility: 'existing detached monster entity and numeric movement projection; player HP/uses stay independent' } },
  referenceModels: {
    version: 1,
    status: 'canonical import storage after copy resolution; no rule/editor/viewer integration',
    storageField: 'ContentRecord.referenceDefinition',
    discriminator: 'kind',
    adapter: 'src/app/content/reference-record-adapter.ts',
    factories: 'src/app/content/reference-content-adapter.ts',
    models: {
      object: 'src/app/content/object.model.ts', condition: 'src/app/content/condition.model.ts',
      sense: 'src/app/content/sense.model.ts', skill: 'src/app/content/skill.model.ts',
      action: 'src/app/content/action.model.ts', facility: 'src/app/content/bastion.model.ts',
      variantrule: 'src/app/content/variant-rule.model.ts', disease: 'src/app/content/disease.model.ts',
      vehicle: 'src/app/content/vehicle.model.ts',
    },
    validation: 'exact pinned site/brew record schema selected by import provenance, before/after inheritance',
    data: 'source metadata retained without raw payload duplication; copy provenance stays in record.data',
  },
  sharedContracts: {
    proficiencyGrants: { schema: 'util.json#/$defs/{skill,language,tool,armor,weapon}Proficiencies',
      storage: 'existing source fields or canonical class/character-option proficiency fields',
      consumers: 'separate typed structured packages and class display proficiencies; species uses validated source accessor' },
    entries: { schema: 'entry.json', validation: 'deep validation at full source import boundary',
      consumers: 'generated source entry variants in rendering, typed catalog access, higher-level descriptions and standalone/nested table reference traversal',
      extensions: 'generic JSON traversal retained for schema-permitted open metadata and unsupported renderable entry types' },
    attachedSpells: { schema: 'items-shared.json#/$defs/itemAttachedSpells',
      consumers: 'validated flat UID lists and explicit usage groups; no casting automation' },
    additionalSpells: { schema: 'util-additionalspells.json#/$defs/additionalSpellsArray',
      consumers: 'validated typed block/list/choice traversal; unsupported mechanics remain diagnostics' },
  },
  directModelConsumers: consumers,
  templateConsumers: templates,
  limitations: ['Static direct-import and field-access inventory. Follow aliases, helper calls, projections, and indirect consumers during each family migration. Field names do not prove rule semantics or complete automation.'] };
const output = 'docs/migration/content-schema-coverage.json';
await writeFile(output, JSON.stringify(inventory, null, 2) + '\n');
console.log(`${Object.keys(kindSchemas).length} source kinds, ${consumers.length} direct model consumers, ${templates.length} templates: ${output}`);
