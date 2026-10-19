import { ExportedCharacter } from './models/character.model';

/** Derive a short identity line; never interpret arbitrary feature-source names as classes. */
export function characterClasses(sheet: ExportedCharacter | null | undefined): string[] {
  if (!sheet) return [];
  const classes = (sheet.creatorWizard?.classes ?? []).flatMap(selection => {
    try {
      const key = JSON.parse(selection.classKey);
      if (!Array.isArray(key) || key[0] !== 'class' || typeof key[1] !== 'string') return [];
      const name = key[1].replace(/\b\p{L}/gu, (letter: string) => letter.toUpperCase());
      return [`${name} ${selection.level}`];
    } catch { return []; }
  });
  if (!classes.length) classes.push(...new Set((sheet.features ?? []).map(feature => feature.featureEntity?.className?.trim()).filter((name): name is string => !!name)));
  return classes;
}

export function characterDescription(sheet: ExportedCharacter | null | undefined, includeName = false): string {
  if (!sheet) return '';
  const classes = characterClasses(sheet);
  const identity = [sheet.species?.name?.trim(), classes.join(' / ')].filter(Boolean).join(' ');
  const background = typeof sheet.background?.name === 'string' ? sheet.background.name.trim() : '';
  const details = [identity || `Level ${sheet.character?.level ?? 1}`, background].filter(Boolean).join(' · ');
  return includeName ? [sheet.character?.name?.trim() || 'Unnamed Character', details].join(' — ') : details;
}
