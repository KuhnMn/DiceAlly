import { REFERENCE_VALIDATORS } from './generated/reference-registry';
import type { ReferenceKind } from './reference-content.model';
import type { SchemaValidator } from './generated/site-validators.mjs';
import type { SiteSourceByKind } from './generated/site-source';
import { ImportDiagnostic } from './content.model';
import { CORE_FILE_VALIDATORS } from './generated/schema-registry';

export type SourceKind = keyof SiteSourceByKind;
export type SchemaProfile = 'site' | 'brew';

/** Static routes, never a list of validators to try until one accepts the data. */
const CORE_SCHEMAS: Readonly<Record<string, string>> = CORE_FILE_VALIDATORS;

export function coreSchemaName(file: string): string {
  const exact = CORE_SCHEMAS[file];
  if (exact) return exact;
  if (/^class\/[^/]+\.json$/.test(file)) return 'class_class';
  if (/^spells\/[^/]+\.json$/.test(file)) return 'spells_spells';
  if (/^bestiary\/[^/]+\.json$/.test(file)) return 'bestiary_bestiary';
  throw new Error(`No pinned content schema is registered for ${file}.`);
}

type Validators = Record<string, SchemaValidator>;
const profiles: Partial<Record<SchemaProfile, Promise<Validators>>> = {};
async function validators(profile: SchemaProfile): Promise<Validators> {
  // The schema compiler is build-time only. Load brew code only for brew input.
  return profiles[profile] ??= (profile === 'site'
    ? import('./generated/site-validators.mjs') : import('./generated/brew-validators.mjs'));
}

export class ContentSchemaError extends Error {
  constructor(readonly diagnostics: ImportDiagnostic[]) {
    const first = diagnostics[0];
    super(`Content validation failed for ${first.file} at ${first.path || '/'}: ${first.message}`);
  }
}

async function validate(value: unknown, file: string, profile: SchemaProfile, name: string): Promise<void> {
  const validate = (await validators(profile))[name];
  if (!validate) throw new Error(`Missing generated validator ${profile}/${name}.`);
  if (validate(value)) return;
  throw new ContentSchemaError((validate.errors ?? []).map(error => ({
    severity: 'error', code: 'schema-invalid', phase: 'validate', file,
    path: error.instancePath, schemaPath: error.schemaPath,
    message: `${error.message ?? error.keyword} (${JSON.stringify(error.params)})`,
  })));
}

export async function validateCoreDocument(value: unknown, file: string): Promise<void> {
  await validate(value, file, 'site', coreSchemaName(file));
}

export async function validateHomebrewDocument(value: unknown, file: string): Promise<void> {
  await validate(value, file, 'brew', 'homebrew');
}

/** Validate a complete record after inheritance against its exact pinned source profile. */
export async function validateReferenceSource(kind: ReferenceKind, value: unknown, file: string): Promise<void> {
  await validate(value, file, file.startsWith('homebrew/') ? 'brew' : 'site', REFERENCE_VALIDATORS[kind]);
}
