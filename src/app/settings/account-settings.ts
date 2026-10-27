export const SETTING_KEYS = ['theme', 'sourceBooks'] as const;
export type SettingKey = typeof SETTING_KEYS[number];
export interface AccountSetting { value: string; mutationId: string; }
export interface CachedSetting extends AccountSetting { pending: boolean; }
export type SettingsCache = Partial<Record<SettingKey, CachedSetting>>;
export const THEMES = ['light-mc', 'dark-mc', 'light-royal', 'dark-royal', 'light-ethereal', 'dark-ethereal', 'light-forge', 'dark-forge', 'light-glade', 'dark-glade'] as const;
export type Theme = typeof THEMES[number];

/** JSON strings retain an empty Source Books selection (Firebase otherwise removes empty arrays). */
export function validSetting(key: SettingKey, input: unknown): input is AccountSetting {
  const record = input as AccountSetting | null;
  if (!record || typeof record.value !== 'string' || record.value.length > 32_000 ||
      typeof record.mutationId !== 'string' || !/^[a-f0-9-]{36}$/.test(record.mutationId)) return false;
  try {
    const value: unknown = JSON.parse(record.value);
    return key === 'theme' ? THEMES.includes(value as Theme) : Array.isArray(value) &&
      value.length <= 1000 && value.every(book => typeof book === 'string' && book.length <= 120);
  } catch { return false; }
}

export function acknowledgeSetting(cache: SettingsCache, key: SettingKey, uploaded: AccountSetting) {
  // A newer change made during a request must remain pending.
  if (cache[key]?.mutationId === uploaded.mutationId) cache[key]!.pending = false;
}
