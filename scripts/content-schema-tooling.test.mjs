import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import ts from 'typescript';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { createSchemaValidator, validationSchema } from './content-schema-validator.mjs';
import { generateSourceTypes } from './content-schema-types.mjs';
import { schemaFiles } from './content-schema-config.mjs';
import * as site from '../src/app/content/generated/site-validators.mjs';
import * as brew from '../src/app/content/generated/brew-validators.mjs';

const output = await build({ entryPoints: ['src/app/content/content-fixtures.testing.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { coreDocumentFixture, homebrewDocumentFixture } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);

test('all vendored schema bytes match their reviewed manifest', async () => {
  const manifest = JSON.parse(await readFile('schemas/5etools/manifest.json', 'utf8'));
  for (const [profile, files] of Object.entries(manifest.profiles)) for (const [file, info] of Object.entries(files)) {
    const bytes = await readFile(`schemas/5etools/${profile}/${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), info.sha256, `${profile}/${file}`);
  }
});

test('synthetic pipeline fixtures satisfy each full source schema', () => {
  for (const file of schemaFiles) {
    const value = file.endsWith('index.json') ? { TEST: 'fixture.json' } : coreDocumentFixture(file);
    const validate = site[file.replace(/\.json$/, '').replaceAll(/[-/]/g, '_')];
    assert.equal(validate(value), true, `${file}: ${JSON.stringify(validate.errors)}`);
  }
  assert.equal(brew.homebrew(homebrewDocumentFixture({ spell: [{ name: 'Synthetic', source: 'TESTBREW' }] })), true);
});

test('standalone custom checks retain upstream decimal and date behavior', async () => {
  const ajv = createSchemaValidator();
  const validate = ajv.compile({ type: 'object', properties: {
    amount: { type: 'number', multipleOf: 0.1 }, date: { type: 'string', format: 'date' },
  }, required: ['amount', 'date'], additionalProperties: false });
  const standalone = standaloneCode(ajv, validate);
  const code = await build({ stdin: { contents: standalone, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
  const compiled = (await import(`data:text/javascript;base64,${Buffer.from(code.outputFiles[0].text).toString('base64')}`)).default;
  for (const [input, accepted] of [
    [{ amount: 0.3, date: '2026-02-31' }, true],
    [{ amount: -0.3, date: '2026-10-20' }, true],
    [{ amount: 0.31, date: '2026-10-20' }, false],
    [{ amount: '0.3', date: '2026-10-20' }, false],
    [{ amount: 0.3, date: '2026-2-01' }, false],
  ]) {
    const original = structuredClone(input);
    assert.equal(validate(input), accepted);
    assert.equal(compiled(input), accepted);
    assert.deepEqual(input, original);
  }
});

test('annotation removal preserves fields named like annotations and schema constraints', () => {
  const schema = { type: 'object', description: 'An annotation', properties: {
    description: { type: 'string', minLength: 1 }, title: { const: 'fixed' },
  }, required: ['description', 'title'], additionalProperties: false };
  const cleaned = validationSchema(schema);
  assert.equal(cleaned.description, undefined);
  const validate = createSchemaValidator().compile(cleaned);
  assert.equal(validate({ description: 'text', title: 'fixed' }), true);
  assert.equal(validate({ description: '', title: 'fixed' }), false);
  assert.equal(validate({ description: 'text', title: 'other' }), false);
});

test('nested source schema references resolve from the registered URI without rewriting snapshots', () => {
  const source = { $id: 'class.json', type: 'object', properties: {
    name: { $ref: '../util.json#/$defs/name' },
  }, required: ['name'] };
  const original = structuredClone(source);
  const ajv = createSchemaValidator();
  ajv.addSchema(validationSchema({ $id: 'util.json', $defs: { name: { type: 'string' } } }, 'util.json'), 'util.json');
  ajv.addSchema(validationSchema(source, 'class/class.json'), 'class/class.json');
  const validate = ajv.getSchema('class/class.json');
  assert.equal(validate({ name: 'Wizard' }), true);
  assert.equal(validate({ name: 1 }), false);
  assert.deepEqual(source, original);
});

test('source types preserve recursive references, unions, required fields, and nulls', () => {
  const schemas = new Map([['sample.json', { properties: { sample: { items: { $ref: '#/$defs/node' } } },
    $defs: { node: { type: 'object', properties: {
      value: { type: ['integer', 'null'] }, children: { type: 'array', items: { $ref: '#/$defs/node' } },
    }, required: ['value'], additionalProperties: false } } }]]);
  const generated = generateSourceTypes(schemas, { sample: 'sample.json' }, 'Source');
  const source = generated + `
const valid: Source['sample'] = { value: null, children: [{ value: 2 }] };
// @ts-expect-error a required field must stay required
const absent: Source['sample'] = {};
// @ts-expect-error recursive child values must be checked
const wrong: Source['sample'] = { value: 1, children: [{ value: 'two' }] };
// @ts-expect-error closed objects must not gain an index signature
const extra: Source['sample'] = { value: 1, invented: true };
`;
  const file = '__schema_type_test.ts';
  const options = { strict: true, noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (name, language, ...rest) => name.endsWith(file) ? ts.createSourceFile(name, source, language, true) : read(name, language, ...rest);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host));
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('generated-table contract accepts producer metadata and rejects unknown fields', () => {
  const table = { name: 'Synthetic', source: 'TEST', rows: [['row']], reprintedAs: ['Synthetic|OTHER'],
    basicRules: false, srd: false, parentEntity: { prop: 'item', uid: 'Synthetic|TEST' },
    chapter: { name: 'Appendix', ordinal: { type: 'appendix' }, index: 0 } };
  const document = { table: [table], tableGroup: [] };
  assert.equal(site.generated_tables(document), true, JSON.stringify(site.generated_tables.errors));
  assert.equal(site.generated_tables({ ...document, table: [{ ...table, invented: true }] }), false);
  assert.equal(site.tables(document), false, 'the generated-file exception must not widen the ordinary table schema');
});

test('resolved reference validators preserve source-profile differences for all stored categories', () => {
  const routes = {
    object: 'objects.json', condition: 'conditionsdiseases.json', status: 'conditionsdiseases.json', sense: 'senses.json', skill: 'skills.json',
    action: 'actions.json', facility: 'bastions.json', variantrule: 'variantrules.json',
    disease: 'conditionsdiseases.json', vehicle: 'vehicles.json',
  };
  for (const [kind, file] of Object.entries(routes)) {
    const source = coreDocumentFixture(file)[kind][0];
    for (const validators of [site, brew]) {
      const validate = validators[`reference_${kind}`];
      assert.equal(validate(source), true, `${kind}: ${JSON.stringify(validate.errors)}`);
      assert.equal(validate({}), false, `${kind} must not accept an incomplete resolved definition`);
    }
  }
  const condition = { name: 'Synthetic', source: 'TEST', entries: [] };
  assert.equal(site.reference_condition({ ...condition, srd: true }), true);
  assert.equal(brew.reference_condition({ ...condition, srd: true }), false);
  assert.equal(brew.reference_condition({ ...condition, color: 'ff00ff' }), true);
  assert.equal(site.reference_condition({ ...condition, color: 'ff00ff' }), false);
  assert.equal(site.reference_status({ ...condition, srd: true }), true);
  assert.equal(brew.reference_status({ ...condition, srd: true }), false);
  assert.equal(brew.reference_status({ ...condition, color: 'ff00ff' }), true);
  assert.equal(site.reference_status({ ...condition, color: 'ff00ff' }), false);
});
