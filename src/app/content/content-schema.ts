import { loadWithRetry } from '../loading/lazy-load';
import { REFERENCE_VALIDATORS } from './generated/reference-registry';
import type { ReferenceKind } from './reference-content.model';
import type { SchemaValidator } from './generated/site-validators.mjs';
import type { SiteSourceByKind } from './generated/site-source';
import { ImportDiagnostic } from './content.model';
import { CORE_FILE_VALIDATORS } from './generated/schema-registry';
import { metadataWarningCandidate } from './content-metadata-warnings';

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
  return profiles[profile] ??= loadWithRetry<Validators>(() => profile === 'site'
    ? import('./generated/site-validators.mjs') : import('./generated/brew-validators.mjs'),
    profile === 'site' ? 'generated_tables' : 'homebrew')
    .catch(error => { delete profiles[profile]; throw error; });
}

export class ContentSchemaError extends Error {
  constructor(readonly diagnostics: ImportDiagnostic[]) {
    const first = diagnostics.find(issue => issue.severity === 'error') ?? diagnostics[0];
    super(`Content validation failed for ${first.file} at ${first.path || '/'}: ${first.message}`);
  }
}

async function validate(value: unknown, file: string, profile: SchemaProfile, name: string): Promise<ImportDiagnostic[]> {
  const validate = (await validators(profile))[name];
  if (!validate) throw new Error(`Missing generated validator ${profile}/${name}.`);
  const warnings: ImportDiagnostic[] = [];
  let candidate = value;
  while (!validate(candidate)) {
    const errors = [...validate.errors ?? []];
    const softened = metadataWarningCandidate(candidate, errors, file);
    if (softened) { warnings.push(...softened.diagnostics); candidate = softened.value; continue; }
    throw new ContentSchemaError([...warnings, ...errors.map(error => ({
      severity: 'error' as const, code: 'schema-invalid' as const, phase: 'validate' as const, file,
      path: error.instancePath, schemaPath: error.schemaPath,
      message: `${error.message ?? error.keyword} (${JSON.stringify(error.params)})`,
    }))]);
  }
  return warnings;
}

/** Return nonblocking metadata warnings; never modify source input or relax rule/shape errors. */
export async function validateCoreDocument(value: unknown, file: string): Promise<ImportDiagnostic[]> {
  return validate(value, file, 'site', coreSchemaName(file));
}

export async function validateHomebrewDocument(value: unknown, file: string): Promise<ImportDiagnostic[]> {
  return validate(value, file, 'brew', 'homebrew');
}

/** Validate a complete record after inheritance against its exact pinned source profile. */
export async function validateReferenceSource(kind: ReferenceKind, value: unknown, file: string): Promise<void> {
  await validate(value, file, file.startsWith('homebrew/') ? 'brew' : 'site', REFERENCE_VALIDATORS[kind]);
}
