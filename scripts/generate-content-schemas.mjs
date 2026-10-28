import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';
import { createSchemaValidator, validationSchema } from './content-schema-validator.mjs';
import { generateSourceTypes } from './content-schema-types.mjs';
import { schemaFiles, kindSchemas, referenceSchemas, snapshotDirectory, generatedDirectory } from './content-schema-config.mjs';

const check = process.argv.includes('--check');
const manifest = JSON.parse(await readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8'));
const generatedTables = JSON.parse(await readFile('schemas/content/generated-tables.json', 'utf8'));
const speciesContract = JSON.parse(await readFile('schemas/content/species.json', 'utf8'));
const classContract = JSON.parse(await readFile('schemas/content/class.json', 'utf8'));
const characterOptionContract = JSON.parse(await readFile('schemas/content/character-option.json', 'utf8'));
const spellContract = JSON.parse(await readFile('schemas/content/spell.json', 'utf8'));
const itemContract = JSON.parse(await readFile('schemas/content/item.json', 'utf8'));
const monsterContract = JSON.parse(await readFile('schemas/content/monster.json', 'utf8'));
const artifactHashes = {};
const reviewedHashes = check ? JSON.parse(await readFile(path.join(generatedDirectory, 'artifact-hashes.json'), 'utf8')) : undefined;
await mkdir(generatedDirectory, { recursive: true });
const emit = async (name, contents) => {
  const target = path.join(generatedDirectory, name);
  artifactHashes[name] = createHash('sha256').update(contents).digest('hex');
  if (check) {
    const actual = await readFile(target, 'utf8').catch(() => undefined);
    if (reviewedHashes[name] !== artifactHashes[name] || (actual !== undefined && actual !== contents)
        || (actual === undefined && !name.endsWith('.mjs'))) {
      throw new Error(`Generated artifact drift: ${target}. Run npm run schemas:generate.`);
    }
  } else await writeFile(target, contents);
};

for (const profile of ['site', 'brew']) {
  const ajv = createSchemaValidator();
  const schemas = new Map();
  const directory = path.resolve(snapshotDirectory, profile);
  for (const [file, info] of Object.entries(manifest.profiles[profile])) {
    const bytes = await readFile(path.join(directory, file));
    if (createHash('sha256').update(bytes).digest('hex') !== info.sha256) throw new Error(`Schema checksum mismatch: ${profile}/${file}`);
    const schema = JSON.parse(bytes);
    schemas.set(info.uri ?? file, schema);
    ajv.addSchema(validationSchema(schema, info.uri ?? file), info.uri ?? file);
  }
  const roots = [...schemaFiles, ...(profile === 'brew' ? ['homebrew.json'] : [])];
  const validators = Object.fromEntries(roots.map(file => [file.replace(/\.json$/, '').replaceAll(/[-/]/g, '_'), file]));
  for (const [kind, schema] of Object.entries(referenceSchemas)) validators[`reference_${kind}`] = schema;
  if (profile === 'site') {
    ajv.addSchema(validationSchema(generatedTables), generatedTables.$id);
    validators['generated_tables'] = generatedTables.$id;
  }
  const code = standaloneCode(ajv, validators);
  // Bundle only standalone runtime helpers, never the schema compiler, into browser ESM.
  const bundled = await build({ stdin: { contents: code, resolveDir: process.cwd(), sourcefile: `${profile}-validators.js` },
    bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', minify: true, legalComments: 'none' });
  await emit(`${profile}-validators.mjs`, `// Generated from the pinned schemas. Do not edit.\n${bundled.outputFiles[0].text}`);
  await emit(`${profile}-validators.d.mts`, `import type { ErrorObject } from 'ajv';\nexport interface SchemaValidator { (data: unknown): boolean; errors?: ErrorObject[] | null; }\n${Object.keys(validators).map(name => `export const ${name}: SchemaValidator;`).join('\n')}\n`);

  const types = generateSourceTypes(schemas, kindSchemas, `${profile === 'site' ? 'Site' : 'Brew'}SourceByKind`);
  await emit(`${profile}-source.d.ts`, types);
  console.log(`${profile}: ${Object.keys(validators).length} validators; ${bundled.outputFiles[0].contents.length} validator bytes; ${types.length} type characters`);
}
const speciesAjv = createSchemaValidator();
const speciesCode = standaloneCode(speciesAjv, speciesAjv.compile(speciesContract));
const speciesBundle = await build({ stdin: { contents: speciesCode, resolveDir: process.cwd() }, bundle: true,
  write: false, platform: 'browser', format: 'esm', target: 'es2022', minify: true, legalComments: 'none' });
await emit('species-validators.mjs', `// Generated from schemas/content/species.json. Do not edit.\n${speciesBundle.outputFiles[0].text}`);
await emit('species-validators.d.mts', `import type { SchemaValidator } from './site-validators.mjs';\ndeclare const validateSpecies: SchemaValidator;\nexport default validateSpecies;\n`);
// Canonical class/option fields reuse upstream contracts and share their reachable validators.
const classAjv = createSchemaValidator();
for (const [file, info] of Object.entries(manifest.profiles.brew)) {
  const schema = JSON.parse(await readFile(path.join(snapshotDirectory, 'brew', file), 'utf8'));
  const uri = new URL(info.uri ?? file, 'https://ally.local/5etools/brew/').href;
  const qualify = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') value.$ref = new URL(value.$ref, uri).href;
    for (const child of Object.values(value)) if (typeof child === 'object') qualify(child);
  };
  qualify(schema); schema.$id = uri;
  classAjv.addSchema(validationSchema(schema), uri);
}
classAjv.addSchema(classContract);
classAjv.addSchema(characterOptionContract);
const classCode = standaloneCode(classAjv, { validateClass: classContract.$id, validateCharacterOption: characterOptionContract.$id });
const classBundle = await build({ stdin: { contents: classCode, resolveDir: process.cwd() }, bundle: true,
  write: false, platform: 'browser', format: 'esm', target: 'es2022', minify: true, legalComments: 'none' });
await emit('class-validators.mjs', `// Generated from canonical class/character-option contracts and pinned upstream fields. Do not edit.\n${classBundle.outputFiles[0].text}`);
await emit('class-validators.d.mts', `import type { SchemaValidator } from './site-validators.mjs';\nexport const validateClass: SchemaValidator;\nexport const validateCharacterOption: SchemaValidator;\n`);
async function emitDefaultValidator(name, schema, description, exportName = 'validate') {
  const code = standaloneCode(classAjv, classAjv.compile(schema));
  const bundle = await build({
    stdin: { contents: code, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
  });
  await emit(`${name}-validators.mjs`,
    `// Generated from ${description}. Do not edit.\n${bundle.outputFiles[0].text}`);
  await emit(`${name}-validators.d.mts`,
    `import type { SchemaValidator } from './site-validators.mjs';\ndeclare const ${exportName}: SchemaValidator;\nexport default ${exportName};\n`);
}

await emitDefaultValidator('spell', spellContract,
  'schemas/content/spell.json and pinned upstream fields', 'validateSpell');
await emitDefaultValidator('item', itemContract,
  'schemas/content/item.json and pinned upstream fields', 'validateItem');
await emitDefaultValidator('additional-spells', {
  $ref: 'https://ally.local/5etools/brew/util-additionalspells.json#/$defs/additionalSpellsArray',
}, 'pinned util-additionalspells.json', 'validateAdditionalSpells');

// Shared payloads retain their source representation and exact pinned contracts.
const sharedContracts = {
  proficiency: {
    type: 'object',
    properties: Object.fromEntries([
      ['skills', 'skillProficiencies'],
      ['languages', 'languageProficiencies'],
      ['tools', 'toolProficiencies'],
      ['armor', 'armorProficiencies'],
      ['weapons', 'weaponProficiencies'],
    ].map(([key, field]) => [key, {
      $ref: `https://ally.local/5etools/brew/util.json#/$defs/${field}`,
    }])),
    additionalProperties: false,
  },
  'attached-spells': {
    $ref: 'https://ally.local/5etools/brew/items-shared.json#/$defs/itemAttachedSpells',
  },
};
for (const [name, schema] of Object.entries(sharedContracts)) {
  await emitDefaultValidator(name, schema, 'pinned shared source contracts');
}
await emitDefaultValidator('monster', monsterContract,
  'schemas/content/monster.json and pinned upstream fields', 'validateMonster');
const snapshotId = createHash('sha256').update(JSON.stringify({ manifest, referenceSchemas, generatedTables, speciesContract, classContract, characterOptionContract, spellContract, itemContract, monsterContract })).digest('hex');
await emit('schema-version.ts', `// Generated from the pinned schema manifest.\nexport const CONTENT_SCHEMA_COMMIT = '${manifest.commit}';\nexport const CONTENT_SCHEMA_PACKAGE_VERSION = '${manifest.packageVersion}';\nexport const CONTENT_SCHEMA_ID = '${snapshotId}';\n`);
const fileValidators = Object.fromEntries(schemaFiles.map(file => [file, file.replace(/\.json$/, '').replaceAll(/[-/]/g, '_')]));
Object.assign(fileValidators, { 'generated/gendata-variantrules.json': 'variantrules', 'generated/gendata-tables.json': 'generated_tables' });
await emit('schema-registry.ts', `// Generated from scripts/content-schema-config.mjs. Do not edit.\nexport const SOURCE_KINDS = ${JSON.stringify(Object.keys(kindSchemas), null, 2)} as const;\nexport const CORE_FILE_VALIDATORS = ${JSON.stringify(fileValidators, null, 2)} as const;\n`);
await emit('reference-registry.ts', `// Generated from reviewed reference-record schema routes.\nexport const REFERENCE_VALIDATORS = ${JSON.stringify(Object.fromEntries(Object.keys(referenceSchemas).map(kind => [kind, `reference_${kind}`])), null, 2)} as const;\n`);
if (!check) await writeFile(path.join(generatedDirectory, 'artifact-hashes.json'), JSON.stringify(artifactHashes, null, 2) + '\n');
