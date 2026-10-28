import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { _ } from 'ajv/dist/compile/codegen/index.js';
import NP from 'number-precision';

/** Equivalent to upstream UtilAjv, including a standalone-compatible multipleOf. */
export function createSchemaValidator() {
  const ajv = new Ajv2020({ allowUnionTypes: true, inlineRefs: false, loopRequired: 5, loopEnum: 5,
    code: { source: true, esm: true }, validateFormats: true });
  addFormats(ajv);
  ajv.addKeyword({ keyword: 'version', validate: false });
  ajv.addKeyword({ keyword: 'markdownDescription', validate: false });
  // Upstream intentionally accepts any YYYY-MM-DD, including non-calendar dates.
  ajv.addFormat('date', /^\d\d\d\d-\d\d-\d\d$/);
  ajv.removeKeyword('multipleOf');
  ajv.addKeyword({ keyword: 'multipleOf', type: 'number', schemaType: 'number',
    metaSchema: { type: 'number' }, errors: false,
    code(context) {
      const divide = context.gen.scopeValue('func', {
        ref: NP.divide, code: _`require("number-precision").divide`,
      });
      context.fail(_`!Number.isInteger(${divide}(${context.data}, ${context.schemaCode}))`);
    },
  });
  return ajv;
}

/** Drop annotations and anchor the root URI in compiler input only; snapshots remain verbatim. */
export function validationSchema(schema, uri) {
  if (!schema || typeof schema !== 'object') return schema;
  const result = { ...schema };
  // Some upstream $ids are bare filenames even when their references depend on a subdirectory.
  if (uri) result.$id = uri;
  for (const key of ['title', 'description', 'markdownDescription', 'examples', '$comment', 'version']) delete result[key];
  for (const key of ['$defs', 'definitions', 'properties', 'patternProperties', 'dependentSchemas']) {
    if (result[key]) result[key] = Object.fromEntries(Object.entries(result[key]).map(([name, value]) => [name, validationSchema(value)]));
  }
  for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) if (result[key]) result[key] = result[key].map(value => validationSchema(value));
  for (const key of ['additionalProperties', 'unevaluatedProperties', 'items', 'contains', 'propertyNames', 'if', 'then', 'else', 'not']) {
    if (result[key] && typeof result[key] === 'object') result[key] = validationSchema(result[key]);
  }
  return result;
}
